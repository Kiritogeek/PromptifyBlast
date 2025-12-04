'use client'

import Link from 'next/link'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-gray-900 border-t border-gray-800 mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
          <div>
            <h3 className="text-white font-semibold mb-4">PromptifyBlast</h3>
            <p className="text-gray-400 text-sm">
              Générez de meilleurs prompts instantanément pour vos modèles d'IA.
            </p>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-4">Liens utiles</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/app" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Générateur
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Premium
                </Link>
              </li>
              <li>
                <Link href="/avis" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Avis
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-4">Légal</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/mentions-legales" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Mentions légales
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 pt-6">
          <p className="text-gray-400 text-sm text-center">
            © {currentYear} PromptifyBlast. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  )
}

