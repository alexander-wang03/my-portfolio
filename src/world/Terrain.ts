import * as THREE from 'three'

export interface TerrainOptions {
    size: number
    segments: number
    heightScale: number
}

export default class Terrain {
    container: THREE.Object3D
    mesh!: THREE.Mesh
    heightData: Float32Array
    size: number
    segments: number
    heightScale: number

    // Rover shadow uniforms — updated by Rover each frame
    shadowUniforms = {
        uShadowPos: { value: new THREE.Vector3() },
        uShadowAngle: { value: 0 },
        uShadowSize: { value: new THREE.Vector2(1, 1.5) },
        uShadowAlpha: { value: 0 },
    }

    // Object shadow DataTexture — updated by Shadows each frame
    // Each shadow uses 2 texels: texel0=(posX, posZ, sizeX, sizeZ), texel1=(angle, alpha, shape, 0)
    static readonly MAX_OBJ_SHADOWS = 128
    objShadowData = new Float32Array(Terrain.MAX_OBJ_SHADOWS * 2 * 4)
    objShadowTexture!: THREE.DataTexture
    objectShadowUniforms!: {
        uObjShadowData: { value: THREE.DataTexture }
        uObjShadowCount: { value: number }
        uObjShadowTexWidth: { value: number }
    }

    constructor(options: TerrainOptions) {
        this.container = new THREE.Object3D()
        this.size = options.size
        this.segments = options.segments
        this.heightScale = options.heightScale
        this.heightData = new Float32Array((this.segments + 1) * (this.segments + 1))

        const texWidth = Terrain.MAX_OBJ_SHADOWS * 2
        this.objShadowTexture = new THREE.DataTexture(
            this.objShadowData, texWidth, 1,
            THREE.RGBAFormat, THREE.FloatType,
        )
        this.objShadowTexture.minFilter = THREE.NearestFilter
        this.objShadowTexture.magFilter = THREE.NearestFilter
        this.objShadowTexture.needsUpdate = true

        this.objectShadowUniforms = {
            uObjShadowData: { value: this.objShadowTexture },
            uObjShadowCount: { value: 0 },
            uObjShadowTexWidth: { value: texWidth },
        }

        this.generateHeightmap()
        this.createMesh()
    }

    private generateHeightmap(): void {
        const res = this.segments + 1

        let minH = Infinity
        let maxH = -Infinity

        const rawHeights = new Float32Array(res * res)

        for (let j = 0; j < res; j++) {
            for (let i = 0; i < res; i++) {
                const x = i / (res - 1)
                const y = j / (res - 1)

                let height = 0

                // Noise frequencies matched to grid resolution (segments=16)
                // so hash boundaries align with grid cells for sharp height changes
                height += this.noise(x * 8.0 + 0.5, y * 8.0 + 0.7) * 0.6
                height += this.noise(x * 16.0 + 3.1, y * 16.0 + 1.9) * 0.3
                height += this.noise(x * 4.0 + 7.3, y * 4.0 + 5.2) * 0.2

                // Flatten center spawn area (smooth Gaussian)
                const distFromCenter = Math.sqrt((x - 0.5) ** 2 + (y - 0.5) ** 2)
                const flattenFactor = Math.exp(-(distFromCenter ** 2) / (2 * 0.08 * 0.08))
                height *= 1 - flattenFactor * 0.85

                rawHeights[j * res + i] = height

                if (height < minH) minH = height
                if (height > maxH) maxH = height
            }
        }

        // Normalize to 0-1
        const range = maxH - minH || 1
        for (let i = 0; i < rawHeights.length; i++) {
            this.heightData[i] = (rawHeights[i] - minH) / range
        }
    }

    private createMesh(): void {
        const geometry = new THREE.PlaneGeometry(
            this.size,
            this.size,
            this.segments,
            this.segments,
        )

        // Rotate plane to be horizontal (XZ plane, Y-up)
        geometry.rotateX(-Math.PI / 2)

        // Bake heights directly into geometry vertex positions
        const posAttr = geometry.attributes.position
        for (let k = 0; k < posAttr.count; k++) {
            const x = posAttr.getX(k)
            const z = posAttr.getZ(k)
            posAttr.setY(k, this.getHeightAt(x, z))
        }
        posAttr.needsUpdate = true
        geometry.computeVertexNormals()
        geometry.computeBoundingBox()
        geometry.computeBoundingSphere()

        // Lighter orange terrain palette (closer to folio-2019)
        const topLeft = new THREE.Color('#f5883c')
        const topRight = new THREE.Color('#ff9043')
        const bottomRight = new THREE.Color('#fccf92')
        const bottomLeft = new THREE.Color('#f5aa58')

        const data = new Uint8Array([
            Math.round(bottomLeft.r * 255), Math.round(bottomLeft.g * 255), Math.round(bottomLeft.b * 255), 255,
            Math.round(bottomRight.r * 255), Math.round(bottomRight.g * 255), Math.round(bottomRight.b * 255), 255,
            Math.round(topLeft.r * 255), Math.round(topLeft.g * 255), Math.round(topLeft.b * 255), 255,
            Math.round(topRight.r * 255), Math.round(topRight.g * 255), Math.round(topRight.b * 255), 255,
        ])

        const gradientTexture = new THREE.DataTexture(data, 2, 2, THREE.RGBAFormat)
        gradientTexture.magFilter = THREE.LinearFilter
        gradientTexture.needsUpdate = true

        const halfSize = this.size / 2
        const material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: true,
            uniforms: {
                tGradient: { value: gradientTexture },
                uHeightScale: { value: this.heightScale },
                uHalfSize: { value: halfSize },
                ...this.shadowUniforms,
                ...this.objectShadowUniforms,
            },
            vertexShader: /* glsl */ `
                varying vec2 vUv;
                varying vec3 vWorldPosition;
                void main() {
                    vUv = uv;
                    vec4 worldPos = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPos.xyz;
                    gl_Position = projectionMatrix * viewMatrix * worldPos;
                }
            `,
            fragmentShader: /* glsl */ `
                uniform sampler2D tGradient;
                uniform float uHeightScale;
                uniform float uHalfSize;

                uniform vec3 uShadowPos;
                uniform float uShadowAngle;
                uniform vec2 uShadowSize;
                uniform float uShadowAlpha;

                uniform sampler2D uObjShadowData;
                uniform int uObjShadowCount;
                uniform float uObjShadowTexWidth;

                varying vec2 vUv;
                varying vec3 vWorldPosition;

                void main() {
                    // Base color from gradient
                    vec3 color = texture2D(tGradient, vUv).rgb;

                    // Flat face normal from screen-space derivatives (low-poly faceted look)
                    vec3 fdx = dFdx(vWorldPosition);
                    vec3 fdy = dFdy(vWorldPosition);
                    vec3 faceNormal = normalize(cross(fdx, fdy));

                    // Directional light for facet shading (high contrast)
                    vec3 lightDir = normalize(vec3(0.3, 1.0, 0.2));
                    float diffuse = dot(faceNormal, lightDir) * 0.5 + 0.5;
                    color *= 0.2 + diffuse * 0.8;

                    // Projected shadow (conforms to terrain faces)
                    vec2 toFrag = vWorldPosition.xz - uShadowPos.xz;
                    float cs = cos(uShadowAngle);
                    float sn = sin(uShadowAngle);
                    vec2 localShadow = vec2(
                        toFrag.x * cs - toFrag.y * sn,
                        toFrag.x * sn + toFrag.y * cs
                    );
                    vec2 q = abs(localShadow) - uShadowSize;
                    float boxDist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
                    float shadowMask = smoothstep(0.5, 0.0, boxDist) * uShadowAlpha;
                    color *= 1.0 - shadowMask * 0.55;

                    // Object shadows (rocks, blocks, letters, signs)
                    for (int i = 0; i < 128; i++) {
                        if (i >= uObjShadowCount) break;

                        float u0 = (float(i) * 2.0 + 0.5) / uObjShadowTexWidth;
                        float u1 = (float(i) * 2.0 + 1.5) / uObjShadowTexWidth;
                        vec4 d0 = texture2D(uObjShadowData, vec2(u0, 0.5));
                        vec4 d1 = texture2D(uObjShadowData, vec2(u1, 0.5));

                        vec2 sPos = d0.xy;
                        vec2 sSize = d0.zw;
                        float sAngle = d1.x;
                        float sAlpha = d1.y;
                        float sShape = d1.z;

                        vec2 toFragObj = vWorldPosition.xz - sPos;
                        float csObj = cos(sAngle);
                        float snObj = sin(sAngle);
                        vec2 localObj = vec2(
                            toFragObj.x * csObj - toFragObj.y * snObj,
                            toFragObj.x * snObj + toFragObj.y * csObj
                        );

                        // Box SDF
                        vec2 qObj = abs(localObj) - sSize;
                        float boxMask = smoothstep(0.3, 0.0,
                            length(max(qObj, 0.0)) + min(max(qObj.x, qObj.y), 0.0));

                        // Ellipse SDF (tight falloff to match rock footprint)
                        float ellipseMask = smoothstep(1.15, 0.6, length(localObj / sSize));

                        float objMask = mix(ellipseMask, boxMask, sShape) * sAlpha;
                        color *= 1.0 - objMask * 0.55;
                    }

                    // Edge fade
                    float edgeDist = max(abs(vWorldPosition.x), abs(vWorldPosition.z)) / uHalfSize;
                    float alpha = smoothstep(1.0, 0.75, edgeDist);

                    gl_FragColor = vec4(color, alpha);
                }
            `,
        })

        this.mesh = new THREE.Mesh(geometry, material)
        this.container.add(this.mesh)

        // Wireframe edges for visible face boundaries
        const edges = new THREE.EdgesGeometry(geometry, 1)
        const edgeMat = new THREE.LineBasicMaterial({
            color: 0x6a2810,
            transparent: true,
            opacity: 0.55,
            linewidth: 2,
        })
        const wireframe = new THREE.LineSegments(edges, edgeMat)
        this.container.add(wireframe)
    }

    // Value noise with full 0-1 range
    private noise(x: number, y: number): number {
        const ix = Math.floor(x)
        const iy = Math.floor(y)
        const fx = x - ix
        const fy = y - iy

        // Linear interpolation (sharp creases for low-poly look)
        const ux = fx
        const uy = fy

        const a = this.hash2d(ix, iy)
        const b = this.hash2d(ix + 1, iy)
        const c = this.hash2d(ix, iy + 1)
        const d = this.hash2d(ix + 1, iy + 1)

        return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
    }

    private hash2d(x: number, y: number): number {
        const n = Math.sin((x + 0.5) * 127.1 + (y + 0.7) * 311.7) * 43758.5453
        return n - Math.floor(n)
    }

    /** Get height at a world XZ coordinate */
    getHeightAt(worldX: number, worldZ: number): number {
        const u = (worldX / this.size) + 0.5
        const v = 0.5 - (worldZ / this.size)

        if (u < 0 || u > 1 || v < 0 || v > 1) return 0

        const res = this.segments + 1
        const ix = Math.min(Math.floor(u * (res - 1)), res - 2)
        const iy = Math.min(Math.floor(v * (res - 1)), res - 2)
        const fx = u * (res - 1) - ix
        const fy = v * (res - 1) - iy

        const h00 = this.heightData[iy * res + ix]
        const h10 = this.heightData[iy * res + ix + 1]
        const h01 = this.heightData[(iy + 1) * res + ix]
        const h11 = this.heightData[(iy + 1) * res + ix + 1]

        const h = h00 * (1 - fx) * (1 - fy) + h10 * fx * (1 - fy) +
                  h01 * (1 - fx) * fy + h11 * fx * fy

        return h * this.heightScale
    }
}
