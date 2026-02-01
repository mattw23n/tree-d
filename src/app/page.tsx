export default function HomePage() {

  return (
    <main className="min-h-screen bg-[#0f0f0d] text-[#e8e2d5]">
      <div className="mx-auto max-w-6xl px-6 py-10 sm:px-8">
        <header className="flex items-center justify-between border-b border-[#2a2722] pb-6">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.3em] text-[#b9b1a4]">Tree-D Studio</p>
            <h1 className="text-2xl font-serif text-[#f4efe6]">Canvas to Relief</h1>
          </div>
          <nav className="hidden gap-6 text-sm text-[#b9b1a4] sm:flex">
            <a className="hover:text-[#f4efe6] transition" href="/search">Search</a>
            <a className="hover:text-[#f4efe6] transition" href="/demo">Demo</a>
            <span className="text-[#6f675b]">View</span>
          </nav>
        </header>

        <section className="mt-14 grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <p className="text-sm uppercase tracking-[0.4em] text-[#a79f92]">AI‑assisted preservation</p>
            <h2 className="text-4xl font-serif leading-tight text-[#f7f1e7] sm:text-5xl">
              Transform paintings into tactile 3D reliefs
            </h2>
            <p className="text-lg text-[#cfc6b7] leading-relaxed">
              Tree‑D converts historic canvases into depth‑aware 3D objects. We analyze brushwork with Marigold
              normal estimation, translate luminance into displacement, and craft roughness maps for a realistic
              museum‑grade surface.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                className="rounded-full border border-[#c8bfae] px-6 py-2 text-sm text-[#f4efe6] hover:bg-[#c8bfae] hover:text-[#0f0f0d] transition"
                href="/search"
              >
                Curate from the Met
              </a>
              <a
                className="rounded-full bg-[#f4efe6] px-6 py-2 text-sm text-[#0f0f0d] hover:bg-[#d9d2c5] transition"
                href="/demo"
              >
                Try the Demo
              </a>
            </div>
          </div>
          <div className="rounded-3xl border border-[#2a2722] bg-gradient-to-b from-[#1a1815] via-[#12110f] to-[#0f0f0d] p-8">
            <div className="space-y-6">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[#b9b1a4]">Featured Relief</p>
              </div>
              <div className="overflow-hidden rounded-2xl border border-[#2a2722] bg-[#0f0f0d]">
                <model-viewer
                  src="/samples/featured-painting-01.gltf"
                  poster="/samples/featured-painting-01.jpg"
                  alt="Featured 3D painting relief"
                  camera-controls
                  auto-rotate
                  shadow-intensity="0.6"
                  exposure="1.1"
                  style={{ width: '100%', height: '320px' }}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16 grid gap-8 border-t border-[#2a2722] pt-10 md:grid-cols-3">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-[#b9b1a4]">01</p>
            <h3 className="text-xl font-serif text-[#f4efe6]">Curatorial Search</h3>
            <p className="text-sm text-[#cfc6b7]">
              Browse the Met collection and select works for relief conversion.
            </p>
          </div>
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-[#b9b1a4]">02</p>
            <h3 className="text-xl font-serif text-[#f4efe6]">Studio View</h3>
            <p className="text-sm text-[#cfc6b7]">
              Inspect each painting in a gallery‑grade 3D viewer with raking light.
            </p>
          </div>
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-[#b9b1a4]">03</p>
            <h3 className="text-xl font-serif text-[#f4efe6]">Experimental Demo</h3>
            <p className="text-sm text-[#cfc6b7]">
              Test custom IDs or upload your own image for rapid prototyping.
            </p>
          </div>
        </section>

        <section className="mt-16 rounded-3xl border border-[#2a2722] bg-[#141311] p-8">
          <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.3em] text-[#b9b1a4]">Technology</p>
              <h3 className="text-2xl font-serif text-[#f4efe6]">Depth inference meets conservation craft</h3>
              <p className="text-sm text-[#cfc6b7]">
                We combine AI‑generated normals with procedural smoothing to preserve pigment flow, then translate
                it into displacement for genuine relief. Roughness maps retain varnish and glaze variation.
              </p>
            </div>
            <div className="space-y-3 text-sm text-[#cfc6b7]">
              <div className="flex items-center justify-between border-b border-[#2a2722] pb-2">
                <span>Normal Estimation</span>
                <span className="text-[#f4efe6]">Marigold</span>
              </div>
              <div className="flex items-center justify-between border-b border-[#2a2722] pb-2">
                <span>Surface Relief</span>
                <span className="text-[#f4efe6]">Displacement</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Material Finish</span>
                <span className="text-[#f4efe6]">Roughness</span>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16 rounded-3xl border border-[#2a2722] bg-[#141311] p-8">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.3em] text-[#b9b1a4]">AR Placement</p>
              <h3 className="text-2xl font-serif text-[#f4efe6]">View the relief in your room (iPhone)</h3>
              <ol className="space-y-3 text-sm text-[#cfc6b7]">
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[#c8bfae]" />
                  Find a painting from the archive and export the USDZ file.
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[#c8bfae]" />
                  Download the USDZ to your iPhone (Files app).
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[#c8bfae]" />
                  Tap the file to open Quick Look, then place the painting using AR.
                </li>
              </ol>
              <p className="text-xs text-[#9a9184]">
                The AR result should resemble the sample below (Thank you Verdio Wong =D).
              </p>
            </div>
            <div className="rounded-2xl border border-[#2a2722] bg-[#0f0f0d] p-3">
              <img
                src="/test_pic.jpg"
                alt="Painting placed in room using AR"
                className="h-full w-full rounded-xl object-cover"
              />
            </div>
          </div>
        </section>

        <footer className="mt-16 border-t border-[#2a2722] pt-6 text-xs text-[#b9b1a4]">
          A museum‑toned studio for turning paintings into spatial artifacts.
        </footer>
      </div>
    </main>
  );
}
