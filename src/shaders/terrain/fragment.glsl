uniform vec3 uSunDirection;
uniform vec3 uBaseColor;
uniform vec3 uCraterColor;
uniform vec3 uHighlightColor;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vHeight;

void main() {
    // Diffuse lighting from sun (harsh, directional — thin atmosphere)
    float diffuse = max(dot(vNormal, uSunDirection), 0.0);

    // Dim ambient — Mars has thin atmosphere with slight scattered light
    float ambient = 0.10;

    // Slight back-lighting for terrain wall definition
    float backLight = max(dot(vNormal, -uSunDirection), 0.0) * 0.04;

    float light = ambient + diffuse * 0.90 + backLight;

    // Slope: how steep is this surface (0 = flat, 1 = vertical)
    float slope = 1.0 - max(vNormal.y, 0.0);

    // Height-based coloring
    // Low areas (valleys, crater floors) are darker reddish-brown
    vec3 surfaceColor = mix(uCraterColor, uBaseColor, smoothstep(0.15, 0.45, vHeight));

    // High areas (ridges, rims) are brighter sandy-orange
    surfaceColor = mix(surfaceColor, uHighlightColor, smoothstep(0.55, 0.85, vHeight));

    // Steep walls get darker (shadow accumulation in regolith)
    surfaceColor *= mix(1.0, 0.45, smoothstep(0.1, 0.5, slope));

    // Subtle color variation based on position (mineral deposits / dust patterns)
    float variation = sin(vWorldPosition.x * 0.3) * sin(vWorldPosition.z * 0.4) * 0.03;
    surfaceColor += variation;

    // Apply lighting
    vec3 finalColor = surfaceColor * light;

    // Edge fade — alpha goes to 0 so stars show through
    float distFromCenter = length(vUv - 0.5) * 2.0;
    float edgeAlpha = smoothstep(1.0, 0.65, distFromCenter);

    gl_FragColor = vec4(finalColor, edgeAlpha);
}
