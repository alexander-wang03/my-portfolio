uniform vec3 uSunDirection;
uniform vec3 uBaseColor;
uniform vec3 uCraterColor;
uniform vec3 uHighlightColor;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vHeight;

// ─── Hash-based value noise ─────────────────────────────────────────

float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
}

float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Fractal Brownian Motion — 4 octaves
float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    for (int i = 0; i < 4; i++) {
        v += a * vnoise(p);
        p = p * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

// ─── Oren-Nayar diffuse (rough surface model) ──────────────────────

float orenNayar(vec3 N, vec3 L, vec3 V, float roughness) {
    float NdotL = max(dot(N, L), 0.0);
    float NdotV = max(dot(N, V), 0.001);

    float sigma2 = roughness * roughness;
    float A = 1.0 - 0.5 * sigma2 / (sigma2 + 0.33);
    float B = 0.45 * sigma2 / (sigma2 + 0.09);

    // Azimuth angle difference via Gram-Schmidt projection
    vec3 Lproj = normalize(L - N * dot(N, L));
    vec3 Vproj = normalize(V - N * dot(N, V));
    float cosPhi = max(dot(Lproj, Vproj), 0.0);

    // sin/tan from dot products (avoids trig functions)
    float sinThL = sqrt(max(1.0 - NdotL * NdotL, 0.0));
    float sinThV = sqrt(max(1.0 - NdotV * NdotV, 0.0));
    float sinAlpha = max(sinThL, sinThV);
    float tanBeta = min(sinThL, sinThV) / max(max(NdotL, NdotV), 0.001);

    return NdotL * (A + B * cosPhi * sinAlpha * tanBeta);
}

// ─── Main ───────────────────────────────────────────────────────────

void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);

    // ── Micro-detail normal perturbation ──
    // Two frequency layers: rocky bumps + fine gravel
    float eps = 0.1;

    float nC = fbm(vWorldPosition.xz * 0.8);
    float nR = fbm((vWorldPosition.xz + vec2(eps, 0.0)) * 0.8);
    float nU = fbm((vWorldPosition.xz + vec2(0.0, eps)) * 0.8);

    vec3 detailNormal = normalize(vNormal + vec3(
        (nC - nR) / eps * 0.35,
        0.0,
        (nC - nU) / eps * 0.35
    ));

    // Fine gravel layer
    float fnC = vnoise(vWorldPosition.xz * 4.0);
    float fnR = vnoise((vWorldPosition.xz + vec2(eps, 0.0)) * 4.0);
    float fnU = vnoise((vWorldPosition.xz + vec2(0.0, eps)) * 4.0);

    detailNormal = normalize(detailNormal + vec3(
        (fnC - fnR) / eps * 0.15,
        0.0,
        (fnC - fnU) / eps * 0.15
    ));

    // ── Lighting (Oren-Nayar for rough regolith) ──
    float diffuse = orenNayar(detailNormal, uSunDirection, viewDir, 0.75);
    float ambient = 0.12;
    float backLight = max(dot(detailNormal, -uSunDirection), 0.0) * 0.04;
    float light = ambient + diffuse * 0.88 + backLight;

    // ── Surface coloring ──
    float slope = 1.0 - max(detailNormal.y, 0.0);

    // Height-driven base palette
    vec3 surfaceColor = mix(uCraterColor, uBaseColor, smoothstep(0.10, 0.40, vHeight));
    surfaceColor = mix(surfaceColor, uHighlightColor, smoothstep(0.55, 0.85, vHeight));

    // Exposed rock on steep slopes (darker gray-brown basalt)
    vec3 rockColor = vec3(0.32, 0.17, 0.10);
    surfaceColor = mix(surfaceColor, rockColor, smoothstep(0.25, 0.65, slope));

    // Fine dust accumulation in flat areas
    vec3 dustColor = vec3(0.78, 0.52, 0.32);
    float dustPattern = fbm(vWorldPosition.xz * 0.12 + 7.3);
    surfaceColor = mix(
        surfaceColor,
        dustColor,
        (1.0 - smoothstep(0.0, 0.15, slope)) * dustPattern * 0.2
    );

    // Large-scale mineral / iron-oxide variation
    float mineralNoise = fbm(vWorldPosition.xz * 0.025);
    surfaceColor *= 0.85 + mineralNoise * 0.30;

    // Medium-scale surface texture
    float medNoise = fbm(vWorldPosition.xz * 0.3 + 13.7);
    surfaceColor *= 0.90 + medNoise * 0.20;

    // Fine grain (individual regolith granules)
    float fineNoise = vnoise(vWorldPosition.xz * 3.0 + 5.1);
    surfaceColor *= 0.94 + fineNoise * 0.12;

    // ── Apply lighting ──
    vec3 finalColor = surfaceColor * light;

    // Subtle specular glint on rock faces (sun reflecting off flat rock)
    vec3 halfDir = normalize(uSunDirection + viewDir);
    float spec = pow(max(dot(detailNormal, halfDir), 0.0), 48.0);
    finalColor += vec3(1.0, 0.92, 0.8) * spec * 0.06 * (0.5 + slope * 0.5);

    // ── Atmospheric haze (Mars: salmon/butterscotch) ──
    float dist = length(vWorldPosition - cameraPosition);
    float fogFactor = 1.0 - exp(-dist * dist * 0.00004);
    vec3 fogColor = vec3(0.65, 0.42, 0.28);
    finalColor = mix(finalColor, fogColor * 0.6, clamp(fogFactor * 0.55, 0.0, 0.45));

    // ── Edge fade (terrain boundary dissolves into space) ──
    float distFromCenter = length(vUv - 0.5) * 2.0;
    float edgeAlpha = smoothstep(1.0, 0.65, distFromCenter);

    gl_FragColor = vec4(finalColor, edgeAlpha);
}
