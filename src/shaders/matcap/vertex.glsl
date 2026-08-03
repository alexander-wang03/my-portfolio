uniform float uRevealProgress;

varying vec3 vViewPosition;
varying vec3 vNormal;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;

void main() {
    vNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);

    vec4 worldPos = modelMatrix * vec4(position, 1.0);

    // Reveal — objects start buried and rise back out as a wave travels
    // outward from the world centre. Whatever is still sunk is hidden by the
    // terrain itself, so this needs no transparency. 0 = fully buried,
    // 1 = fully surfaced; the divisor must exceed the world radius so that
    // even the outermost walls have surfaced by the time progress reaches 1.
    float distanceToCenter = length(worldPos.xz);
    float buried = (uRevealProgress - distanceToCenter / 110.0) * 4.0;
    buried = 1.0 - clamp(buried, 0.0, 1.0);
    buried = pow(buried, 2.0);
    if (uRevealProgress > 0.999) {
        buried = 0.0;
    }
    worldPos.y -= buried * 12.0;

    vWorldPosition = worldPos.xyz;

    vec4 mvPosition = viewMatrix * worldPos;
    vViewPosition = -mvPosition.xyz;

    gl_Position = projectionMatrix * mvPosition;
}
