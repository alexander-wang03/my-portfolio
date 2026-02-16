uniform vec3 uSunDirection;
uniform vec3 uBaseColor;
uniform vec3 uCraterColor;
uniform vec3 uHighlightColor;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vHeight;

void main() {
    // Diffuse lighting from sun (harsh, directional — no atmosphere)
    float diffuse = max(dot(vNormal, uSunDirection), 0.0);

    // Very dim ambient — moon has no atmosphere to scatter light
    float ambient = 0.06;

    // Add slight back-lighting for crater wall definition
    float backLight = max(dot(vNormal, -uSunDirection), 0.0) * 0.03;

    float light = ambient + diffuse * 0.94 + backLight;

    // Slope: how steep is this surface (0 = flat, 1 = vertical)
    float slope = 1.0 - max(vNormal.y, 0.0);

    // Height-based coloring
    // Low areas (crater floors) are darker
    vec3 surfaceColor = mix(uCraterColor, uBaseColor, smoothstep(0.15, 0.45, vHeight));

    // High areas (ridges, crater rims) are brighter
    surfaceColor = mix(surfaceColor, uHighlightColor, smoothstep(0.55, 0.85, vHeight));

    // Steep crater walls get significantly darker
    surfaceColor *= mix(1.0, 0.45, smoothstep(0.1, 0.5, slope));

    // Subtle color variation based on position (prevents uniform gray)
    float variation = sin(vWorldPosition.x * 0.3) * sin(vWorldPosition.z * 0.4) * 0.03;
    surfaceColor += variation;

    // Apply lighting
    vec3 finalColor = surfaceColor * light;

    // Edge fade — alpha goes to 0 so stars show through
    float distFromCenter = length(vUv - 0.5) * 2.0;
    float edgeAlpha = smoothstep(1.0, 0.65, distFromCenter);

    gl_FragColor = vec4(finalColor, edgeAlpha);
}
