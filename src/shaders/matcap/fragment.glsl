uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;

uniform float uIndirectDistanceAmplitude;
uniform float uIndirectDistanceStrength;
uniform float uIndirectDistancePower;
uniform float uIndirectAngleStrength;
uniform float uIndirectAngleOffset;
uniform float uIndirectAnglePower;
uniform vec3 uIndirectColor;

// Edge fade: 0 = disabled, > 0 = terrain half-size
uniform float uEdgeFade;

varying vec3 vViewPosition;
varying vec3 vNormal;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;

void main() {
    // Matcap UV from view-space normal
    vec3 viewDir = normalize(vViewPosition);
    vec3 x = normalize(vec3(viewDir.z, 0.0, -viewDir.x));
    vec3 y = cross(viewDir, x);
    vec2 muv = vec2(dot(x, vNormal), dot(y, vNormal)) * 0.495 + 0.5;

    vec4 matcapColor = texture2D(matcap, muv);
    vec3 outgoingLight = diffuse * matcapColor.rgb;

    // Indirect lighting — warm glow from ground bounce (Y-up adapted)
    float indirectDistanceStrength = clamp(1.0 - vWorldPosition.y / uIndirectDistanceAmplitude, 0.0, 1.0) * uIndirectDistanceStrength;
    indirectDistanceStrength = pow(indirectDistanceStrength, uIndirectDistancePower);

    float indirectAngleStrength = dot(vWorldNormal, vec3(0.0, -1.0, 0.0)) + uIndirectAngleOffset;
    indirectAngleStrength = clamp(indirectAngleStrength * uIndirectAngleStrength, 0.0, 1.0);
    indirectAngleStrength = pow(indirectAngleStrength, uIndirectAnglePower);

    float indirectStrength = indirectDistanceStrength * indirectAngleStrength;
    vec3 finalColor = mix(outgoingLight, uIndirectColor, indirectStrength);

    // Optional terrain edge fade
    float alpha = opacity;
    if (uEdgeFade > 0.0) {
        float edgeDist = max(abs(vWorldPosition.x), abs(vWorldPosition.z)) / uEdgeFade;
        alpha *= smoothstep(1.0, 0.75, edgeDist);
    }

    gl_FragColor = vec4(finalColor, alpha);
}
