import { toast } from 'sonner'
import { TriangleAlertIcon, CircleCheckIcon, ArrowRightIcon } from 'lucide-react'

// Toasts de la séquence HTA (sonner, rendu custom). Même recette « glassy » que la
// fiche express des postes (.gp-rt-tooltip), avec barre d'accent + icône colorées :
//  · alerte « Surcharge détectée » (persistante) — son bouton « Localiser » vole
//    sur le poste en alerte ; le faux curseur le clique (un humain le pourrait aussi).
//  · succès « Incident résolu » (auto-fermeture) au rétablissement du réseau.

// Ids stables : une re-entrée de step REMPLACE le toast au lieu d'en empiler.
const ALERT_ID = 'rt-surcharge-alert'
const RECOVERY_ID = 'rt-incident-resolved'

function AlertToast({ onLocate }: { onLocate: () => void }) {
  return (
    <div className="gp-incident-toast" data-variant="alert" role="alert">
      <span className="gp-incident-toast-bar" aria-hidden />
      <span className="gp-incident-toast-iconwrap" aria-hidden>
        <TriangleAlertIcon />
      </span>
      <div className="gp-incident-toast-body">
        <span className="gp-incident-toast-title">Surcharge détectée</span>
        <span className="gp-incident-toast-meta">P-4521 · Salbris</span>
        <span className="gp-incident-toast-load">
          charge critique <b>102 %</b>
        </span>
      </div>
      <button
        type="button"
        data-rt-localize
        className="gp-incident-toast-action"
        onClick={onLocate}
      >
        Localiser
        <ArrowRightIcon aria-hidden />
      </button>
    </div>
  )
}

function RecoveryToast() {
  return (
    <div className="gp-incident-toast" data-variant="success" role="status">
      <span className="gp-incident-toast-bar" aria-hidden />
      <span className="gp-incident-toast-iconwrap" aria-hidden>
        <CircleCheckIcon />
      </span>
      <div className="gp-incident-toast-body">
        <span className="gp-incident-toast-title">Incident résolu</span>
        <span className="gp-incident-toast-meta">P-4521 · Salbris</span>
        <span className="gp-incident-toast-load">charge nominale rétablie</span>
      </div>
    </div>
  )
}

// Alerte persistante : reste affichée tant que « Localiser » n'est pas cliqué (faux
// curseur ou humain) ou que le step n'est pas quitté.
export function showSurchargeToast(onLocate: () => void): void {
  toast.custom(() => <AlertToast onLocate={onLocate} />, {
    id: ALERT_ID,
    duration: Infinity,
    unstyled: true,
  })
}

export function dismissSurchargeToast(): void {
  toast.dismiss(ALERT_ID)
}

// Succès auto-fermant (~4 s) — joué au rétablissement (step rt-done).
export function showRecoveryToast(): void {
  toast.custom(() => <RecoveryToast />, {
    id: RECOVERY_ID,
    duration: 4200,
    unstyled: true,
  })
}

export function dismissRecoveryToast(): void {
  toast.dismiss(RECOVERY_ID)
}
