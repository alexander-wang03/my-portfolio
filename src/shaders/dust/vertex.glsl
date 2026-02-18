attribute float aAge;
attribute float aMaxAge;
attribute float aSize;

varying float vAlpha;

void main() {
    float life = aAge / aMaxAge;

    // Fade out over lifetime
    vAlpha = 1.0 - life;
    vAlpha *= vAlpha; // Quadratic fade for softer disappearance

    // Grow slightly over lifetime
    float size = aSize * (0.5 + life * 0.5);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (200.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
}
