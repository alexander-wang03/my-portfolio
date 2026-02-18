varying float vAlpha;

void main() {
    // Soft circle
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    float alpha = vAlpha * smoothstep(0.5, 0.2, dist);

    // Warm orange dust (folio-2019 palette)
    gl_FragColor = vec4(0.92, 0.60, 0.30, alpha);
}
