uniform sampler2D uHeightMap;
uniform float uHeightScale;
uniform float uTerrainSize;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vHeight;

void main() {
    vUv = uv;

    // Height is baked into geometry vertices — no shader displacement needed
    vHeight = position.y / uHeightScale;

    // Compute normals from heightmap neighbors (smoother than geometry normals)
    float texelSize = 1.0 / float(textureSize(uHeightMap, 0).x);
    float heightL = texture2D(uHeightMap, uv + vec2(-texelSize, 0.0)).r * uHeightScale;
    float heightR = texture2D(uHeightMap, uv + vec2(texelSize, 0.0)).r * uHeightScale;
    float heightD = texture2D(uHeightMap, uv + vec2(0.0, -texelSize)).r * uHeightScale;
    float heightU = texture2D(uHeightMap, uv + vec2(0.0, texelSize)).r * uHeightScale;

    float worldTexelSize = uTerrainSize * texelSize;
    vec3 computedNormal = normalize(vec3(
        (heightL - heightR) / (2.0 * worldTexelSize),
        1.0,
        (heightD - heightU) / (2.0 * worldTexelSize)
    ));

    vNormal = normalize(normalMatrix * computedNormal);
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
