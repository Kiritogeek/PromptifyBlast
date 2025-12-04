import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Générez de meilleurs prompts instantanément
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Transformez n'importe quelle idée en un prompt parfait pour l'IA.
          </p>
          <Link
            href="/app"
            className="inline-block bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg"
          >
            Commencer à générer des prompts
          </Link>
        </div>

        {/* Features Section */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-12">
            Pourquoi PromptifyBlast ?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 bg-gray-800 rounded-lg shadow-sm border border-gray-700">
              <div className="text-5xl mb-4">⚡</div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Rapide
              </h3>
              <p className="text-gray-300">
                Générez des prompts optimisés en quelques secondes
              </p>
            </div>
            <div className="text-center p-6 bg-gray-800 rounded-lg shadow-sm border border-gray-700">
              <div className="text-5xl mb-4">🎯</div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Précis
              </h3>
              <p className="text-gray-300">
                Des prompts structurés pour des résultats optimaux
              </p>
            </div>
            <div className="text-center p-6 bg-gray-800 rounded-lg shadow-sm border border-gray-700">
              <div className="text-5xl mb-4">🚀</div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Puissant
              </h3>
              <p className="text-gray-300">
                Plusieurs modes pour tous vos besoins créatifs
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

