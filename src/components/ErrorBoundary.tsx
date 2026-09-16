/**
 * @license
 * Barrière de Sécurité & Gestionnaire d'Erreurs Global (Error Boundary)
 * Mina's Food - Mbour, Sénégal
 * 
 * Intercepte les erreurs d'exécution pour éviter les écrans blancs :
 * - Affiche une interface de repli rassurante et professionnelle
 * - Offre un bouton de réinitialisation sécurisée
 * - Consigne les détails de l'incident pour la sérénité du client
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, ShieldAlert, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Mina\'s Food Sécurité] Incident capturé par la barrière d\'erreur :', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-stone-900 text-stone-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full p-8 bg-stone-800 rounded-3xl border border-stone-700 text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
              <ShieldAlert className="w-8 h-8 text-amber-400" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold font-display text-white">
                Une petite pause chez Mina's Food
              </h2>
              <p className="text-xs text-stone-300 leading-relaxed">
                Une difficulté momentanée est survenue dans l'affichage. Vos données et votre panier sont conservés en lieu sûr.
              </p>
              {this.state.error && (
                <div className="mt-2 p-2.5 rounded-xl bg-stone-950 border border-stone-800 text-[11px] text-rose-300 font-mono text-left truncate">
                  {this.state.error.message}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-3 px-4 rounded-xl bg-stone-700 hover:bg-stone-600 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Réessayer</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Recharger la page</span>
              </button>
            </div>

            <p className="text-[11px] text-stone-500">
              Contact atelier Mina's Food : <strong>77 407 81 20</strong>
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
