/**
 * @license
 * Système Unifié de Notifications & Messages d'Erreur / Réussite
 * Mina's Food - Pâtisserie & Traiteur Mbour
 * 
 * Fournit un gestionnaire centralisé pour :
 * - Les messages de succès (fond émeraude, icône de validation, carillon mélodieux)
 * - Les messages d'erreur (fond rose/rouge, diagnostic clair, suggestion d'action, son d'alerte)
 * - Les messages d'avertissement et d'information
 * - Un composant visuel Toast interactif et bannière d'alerte contextuelle
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, AlertOctagon, AlertTriangle, Info, X, RefreshCw } from 'lucide-react';
import { FeedbackNotification, FeedbackType } from '../types/bakery.ts';
import { soundManager } from '../services/soundService.ts';

interface NotifyOptions {
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
}

interface FeedbackContextType {
  notifications: FeedbackNotification[];
  notifySuccess: (title: string, message: string, options?: NotifyOptions) => string;
  notifyError: (title: string, message: string, options?: NotifyOptions) => string;
  notifyWarning: (title: string, message: string, options?: NotifyOptions) => string;
  notifyInfo: (title: string, message: string, options?: NotifyOptions) => string;
  dismissNotification: (id: string) => void;
  clearAllNotifications: () => void;
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

export const FeedbackProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<FeedbackNotification[]>([]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotification = useCallback((
    type: FeedbackType,
    title: string,
    message: string,
    options?: NotifyOptions
  ): string => {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const duration = options?.duration ?? (type === 'error' ? 6000 : 4000);

    const newNotif: FeedbackNotification = {
      id,
      type,
      title,
      message,
      timestamp: Date.now(),
      duration,
      actionLabel: options?.actionLabel,
      onAction: options?.onAction
    };

    // Jouer le son approprié
    if (type === 'success') {
      soundManager.playSuccessChime();
    } else if (type === 'error') {
      soundManager.playErrorChime();
    }

    setNotifications((prev) => [newNotif, ...prev.slice(0, 4)]); // Max 5 à l'écran

    // Minuterie de disparition automatique
    if (duration > 0) {
      setTimeout(() => {
        dismissNotification(id);
      }, duration);
    }

    return id;
  }, [dismissNotification]);

  const notifySuccess = useCallback((title: string, message: string, options?: NotifyOptions) => {
    return addNotification('success', title, message, options);
  }, [addNotification]);

  const notifyError = useCallback((title: string, message: string, options?: NotifyOptions) => {
    return addNotification('error', title, message, options);
  }, [addNotification]);

  const notifyWarning = useCallback((title: string, message: string, options?: NotifyOptions) => {
    return addNotification('warning', title, message, options);
  }, [addNotification]);

  const notifyInfo = useCallback((title: string, message: string, options?: NotifyOptions) => {
    return addNotification('info', title, message, options);
  }, [addNotification]);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <FeedbackContext.Provider
      value={{
        notifications,
        notifySuccess,
        notifyError,
        notifyWarning,
        notifyInfo,
        dismissNotification,
        clearAllNotifications
      }}
    >
      {children}

      {/* Rendu des Toasts Flottants dans le coin inférieur droit */}
      <div 
        id="global-feedback-toasts-container"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3 sm:px-0"
        aria-live="polite"
      >
        {notifications.map((n) => (
          <ToastCard
            key={n.id}
            notification={n}
            onClose={() => dismissNotification(n.id)}
          />
        ))}
      </div>
    </FeedbackContext.Provider>
  );
};

export function useFeedback(): FeedbackContextType {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }
  return context;
}

/**
 * Composant Toast visuel avec styles différenciés Succès / Erreur / Attention
 */
const ToastCard: React.FC<{
  notification: FeedbackNotification;
  onClose: () => void;
}> = ({ notification, onClose }) => {
  const { type, title, message, actionLabel, onAction } = notification;

  const styles = {
    success: {
      container: 'bg-emerald-950/95 border-emerald-500/70 text-emerald-100 shadow-emerald-950/40',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />,
      titleColor: 'text-emerald-200',
      textColor: 'text-emerald-100/90',
      btnColor: 'bg-emerald-800/60 hover:bg-emerald-700/80 text-white'
    },
    error: {
      container: 'bg-rose-950/95 border-rose-500/70 text-rose-100 shadow-rose-950/40',
      icon: <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />,
      titleColor: 'text-rose-200',
      textColor: 'text-rose-100/90',
      btnColor: 'bg-rose-800/60 hover:bg-rose-700/80 text-white'
    },
    warning: {
      container: 'bg-amber-950/95 border-amber-500/70 text-amber-100 shadow-amber-950/40',
      icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />,
      titleColor: 'text-amber-200',
      textColor: 'text-amber-100/90',
      btnColor: 'bg-amber-800/60 hover:bg-amber-700/80 text-white'
    },
    info: {
      container: 'bg-sky-950/95 border-sky-500/70 text-sky-100 shadow-sky-950/40',
      icon: <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />,
      titleColor: 'text-sky-200',
      textColor: 'text-sky-100/90',
      btnColor: 'bg-sky-800/60 hover:bg-sky-700/80 text-white'
    }
  }[type];

  return (
    <div
      className={`pointer-events-auto w-full p-4 rounded-2xl border backdrop-blur-md shadow-2xl transition-all duration-300 animate-slideDown flex gap-3 items-start relative ${styles.container}`}
      role="alert"
    >
      {styles.icon}

      <div className="flex-1 min-w-0 pr-2">
        <h4 className={`text-xs font-bold leading-tight ${styles.titleColor}`}>
          {title}
        </h4>
        <p className={`text-xs mt-0.5 leading-relaxed font-normal ${styles.textColor}`}>
          {message}
        </p>

        {actionLabel && onAction && (
          <button
            type="button"
            onClick={() => {
              onAction();
              onClose();
            }}
            className={`mt-2 px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${styles.btnColor}`}
          >
            <RefreshCw className="w-3 h-3" />
            <span>{actionLabel}</span>
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer shrink-0"
        title="Fermer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

/**
 * Bannière d'Alerte Contextuelle réutilisable pour intégration dans les formulaires et modales
 */
export const AlertBanner: React.FC<{
  type: FeedbackType;
  title?: string;
  message: string;
  className?: string;
  onClose?: () => void;
}> = ({ type, title, message, className = '', onClose }) => {
  const styles = {
    success: {
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-900',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />,
      titleColor: 'text-emerald-950 font-bold'
    },
    error: {
      bg: 'bg-rose-50 border-rose-200 text-rose-900',
      icon: <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />,
      titleColor: 'text-rose-950 font-bold'
    },
    warning: {
      bg: 'bg-amber-50 border-amber-200 text-amber-900',
      icon: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />,
      titleColor: 'text-amber-950 font-bold'
    },
    info: {
      bg: 'bg-sky-50 border-sky-200 text-sky-900',
      icon: <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />,
      titleColor: 'text-sky-950 font-bold'
    }
  }[type];

  return (
    <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${styles.bg} ${className}`} role="alert">
      {styles.icon}
      <div className="flex-1 min-w-0">
        {title && <div className={`text-xs ${styles.titleColor} mb-0.5`}>{title}</div>}
        <div className="text-[11px] leading-relaxed">{message}</div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="text-stone-400 hover:text-stone-700 p-0.5 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
