import { useI18n } from "../../i18n/I18nProvider.js";
import type { LanguageCode } from "../../i18n/resources.js";

type Dict = Record<string, string>;

/** Textos do registo (dicas dos campos) e da verificação (email + documentos), nos 4 idiomas. */
const COPY: Record<LanguageCode, Dict> = {
  pt: {
    "reg.fullNamePh": "Ex.: Maria João Silva", "reg.fullNameHint": "Escreva o nome exactamente como está no seu bilhete de identidade.",
    "reg.emailPh": "exemplo@email.com", "reg.emailHint": "Vamos enviar um código de confirmação para este email.",
    "reg.passwordPh": "Mínimo 12 caracteres", "reg.passwordHint": "Use pelo menos 12 caracteres, misturando letras, números e símbolos.",
    "reg.countryPh": "Seleccione o país", "reg.countryHint": "O país onde vive actualmente.", "reg.common": "Mais comuns", "reg.all": "Todos os países",
    "v.title": "Verificar a sua conta", "v.step1": "Email", "v.step2": "Documentos", "v.step3": "Revisão",
    "v.emailTitle": "Confirme o seu email", "v.emailSent": "Enviámos um código de 6 dígitos para {email}. Pode demorar um minuto; veja também o spam.",
    "v.emailAsk": "Vamos enviar um código de 6 dígitos para {email}.", "v.send": "Enviar código", "v.sending": "A enviar…",
    "v.codeLabel": "Código de 6 dígitos", "v.codeHint": "O código é válido durante 15 minutos.", "v.confirm": "Confirmar email", "v.confirming": "A confirmar…",
    "v.resend": "Reenviar código", "v.resendIn": "Reenviar em {s}s",
    "v.docsTitle": "Envie o seu documento", "v.docsBody": "Tire fotografias nítidas, com boa luz e sem reflexos. Os documentos só são vistos pela equipa de verificação.",
    "v.docType": "Tipo de documento", "v.doc.ID_CARD": "Bilhete de identidade", "v.doc.PASSPORT": "Passaporte", "v.doc.RESIDENCE_PERMIT": "Autorização de residência",
    "v.issuing": "País que emitiu o documento", "v.front": "Frente do documento", "v.back": "Verso do documento", "v.selfie": "Selfie a segurar o documento",
    "v.frontHint": "Todos os cantos visíveis e o texto legível.", "v.backHint": "Fotografe o verso do bilhete.", "v.selfieHint": "O rosto e o documento têm de aparecer na mesma foto.",
    "v.take": "Tirar foto ou escolher", "v.change": "Trocar", "v.submit": "Enviar para análise", "v.submitting": "A enviar…",
    "v.pendingTitle": "Conta a verificar", "v.pendingBody": "Recebemos os seus documentos. A nossa equipa vai analisá-los e será notificado da decisão. Entretanto pode usar o painel.",
    "v.approvedTitle": "Conta verificada", "v.approvedBody": "A sua identidade foi confirmada.",
    "v.rejectedTitle": "Verificação recusada", "v.rejectedBody": "Motivo: {reason}. Pode enviar novos documentos.", "v.rejectedNoReason": "Pode enviar novos documentos.",
    "v.dashboard": "Ir para o painel", "v.later": "Fazer mais tarde",
    "e.invalidCode": "Código incorrecto.", "e.expiredCode": "O código expirou. Peça um novo.", "e.tooMany": "Demasiadas tentativas. Aguarde um minuto.",
    "e.network": "Sem ligação. Tente novamente.", "e.generic": "Algo correu mal. Tente novamente.", "e.required": "Falta enviar todas as fotografias pedidas.",
    "e.notImage": "Escolha uma fotografia (JPG ou PNG).", "e.notVerified": "Confirme primeiro o seu email.", "e.mail": "Não foi possível enviar o email agora. Tente mais tarde.",
    "b.verifyEmail": "Conta a verificar: confirme o seu email", "b.sendDocs": "Conta a verificar: envie o seu bilhete e selfie", "b.pending": "Conta a verificar: documentos em análise",
    "b.rejected": "Verificação recusada. Envie novos documentos", "b.action": "Continuar",
  },
  en: {
    "reg.fullNamePh": "E.g. Maria Joao Silva", "reg.fullNameHint": "Write your name exactly as it appears on your ID.",
    "reg.emailPh": "example@email.com", "reg.emailHint": "We will send a confirmation code to this email.",
    "reg.passwordPh": "At least 12 characters", "reg.passwordHint": "Use at least 12 characters, mixing letters, numbers and symbols.",
    "reg.countryPh": "Select a country", "reg.countryHint": "The country where you currently live.", "reg.common": "Most common", "reg.all": "All countries",
    "v.title": "Verify your account", "v.step1": "Email", "v.step2": "Documents", "v.step3": "Review",
    "v.emailTitle": "Confirm your email", "v.emailSent": "We sent a 6-digit code to {email}. It can take a minute; check spam too.",
    "v.emailAsk": "We will send a 6-digit code to {email}.", "v.send": "Send code", "v.sending": "Sending…",
    "v.codeLabel": "6-digit code", "v.codeHint": "The code is valid for 15 minutes.", "v.confirm": "Confirm email", "v.confirming": "Confirming…",
    "v.resend": "Resend code", "v.resendIn": "Resend in {s}s",
    "v.docsTitle": "Upload your document", "v.docsBody": "Take sharp photos in good light, without glare. Documents are only seen by the verification team.",
    "v.docType": "Document type", "v.doc.ID_CARD": "ID card", "v.doc.PASSPORT": "Passport", "v.doc.RESIDENCE_PERMIT": "Residence permit",
    "v.issuing": "Country that issued the document", "v.front": "Front of the document", "v.back": "Back of the document", "v.selfie": "Selfie holding the document",
    "v.frontHint": "All corners visible and text readable.", "v.backHint": "Photograph the back of the ID.", "v.selfieHint": "Your face and the document must appear in the same photo.",
    "v.take": "Take photo or choose", "v.change": "Change", "v.submit": "Send for review", "v.submitting": "Sending…",
    "v.pendingTitle": "Account being verified", "v.pendingBody": "We received your documents. Our team will review them and you will be notified. Meanwhile you can use the dashboard.",
    "v.approvedTitle": "Account verified", "v.approvedBody": "Your identity has been confirmed.",
    "v.rejectedTitle": "Verification rejected", "v.rejectedBody": "Reason: {reason}. You can upload new documents.", "v.rejectedNoReason": "You can upload new documents.",
    "v.dashboard": "Go to dashboard", "v.later": "Do it later",
    "e.invalidCode": "Wrong code.", "e.expiredCode": "The code expired. Request a new one.", "e.tooMany": "Too many attempts. Wait a minute.",
    "e.network": "No connection. Try again.", "e.generic": "Something went wrong. Try again.", "e.required": "All requested photos are required.",
    "e.notImage": "Choose a photo (JPG or PNG).", "e.notVerified": "Confirm your email first.", "e.mail": "We could not send the email now. Try later.",
    "b.verifyEmail": "Account being verified: confirm your email", "b.sendDocs": "Account being verified: send your ID and selfie", "b.pending": "Account being verified: documents under review",
    "b.rejected": "Verification rejected. Send new documents", "b.action": "Continue",
  },
  es: {
    "reg.fullNamePh": "Ej.: María José Silva", "reg.fullNameHint": "Escriba el nombre tal como aparece en su documento de identidad.",
    "reg.emailPh": "ejemplo@email.com", "reg.emailHint": "Enviaremos un código de confirmación a este correo.",
    "reg.passwordPh": "Mínimo 12 caracteres", "reg.passwordHint": "Use al menos 12 caracteres, mezclando letras, números y símbolos.",
    "reg.countryPh": "Seleccione el país", "reg.countryHint": "El país donde vive actualmente.", "reg.common": "Más comunes", "reg.all": "Todos los países",
    "v.title": "Verificar su cuenta", "v.step1": "Correo", "v.step2": "Documentos", "v.step3": "Revisión",
    "v.emailTitle": "Confirme su correo", "v.emailSent": "Enviamos un código de 6 dígitos a {email}. Puede tardar un minuto; revise también el spam.",
    "v.emailAsk": "Enviaremos un código de 6 dígitos a {email}.", "v.send": "Enviar código", "v.sending": "Enviando…",
    "v.codeLabel": "Código de 6 dígitos", "v.codeHint": "El código es válido durante 15 minutos.", "v.confirm": "Confirmar correo", "v.confirming": "Confirmando…",
    "v.resend": "Reenviar código", "v.resendIn": "Reenviar en {s}s",
    "v.docsTitle": "Envíe su documento", "v.docsBody": "Tome fotos nítidas, con buena luz y sin reflejos. Solo el equipo de verificación ve los documentos.",
    "v.docType": "Tipo de documento", "v.doc.ID_CARD": "Documento de identidad", "v.doc.PASSPORT": "Pasaporte", "v.doc.RESIDENCE_PERMIT": "Permiso de residencia",
    "v.issuing": "País que emitió el documento", "v.front": "Frente del documento", "v.back": "Reverso del documento", "v.selfie": "Selfie sosteniendo el documento",
    "v.frontHint": "Todas las esquinas visibles y el texto legible.", "v.backHint": "Fotografíe el reverso del documento.", "v.selfieHint": "Su rostro y el documento deben salir en la misma foto.",
    "v.take": "Tomar foto o elegir", "v.change": "Cambiar", "v.submit": "Enviar a revisión", "v.submitting": "Enviando…",
    "v.pendingTitle": "Cuenta en verificación", "v.pendingBody": "Recibimos sus documentos. Nuestro equipo los revisará y recibirá una notificación. Mientras tanto puede usar el panel.",
    "v.approvedTitle": "Cuenta verificada", "v.approvedBody": "Su identidad fue confirmada.",
    "v.rejectedTitle": "Verificación rechazada", "v.rejectedBody": "Motivo: {reason}. Puede enviar nuevos documentos.", "v.rejectedNoReason": "Puede enviar nuevos documentos.",
    "v.dashboard": "Ir al panel", "v.later": "Hacerlo más tarde",
    "e.invalidCode": "Código incorrecto.", "e.expiredCode": "El código expiró. Pida uno nuevo.", "e.tooMany": "Demasiados intentos. Espere un minuto.",
    "e.network": "Sin conexión. Inténtelo de nuevo.", "e.generic": "Algo salió mal. Inténtelo de nuevo.", "e.required": "Faltan las fotografías solicitadas.",
    "e.notImage": "Elija una fotografía (JPG o PNG).", "e.notVerified": "Confirme primero su correo.", "e.mail": "No se pudo enviar el correo ahora. Inténtelo más tarde.",
    "b.verifyEmail": "Cuenta en verificación: confirme su correo", "b.sendDocs": "Cuenta en verificación: envíe su documento y selfie", "b.pending": "Cuenta en verificación: documentos en revisión",
    "b.rejected": "Verificación rechazada. Envíe nuevos documentos", "b.action": "Continuar",
  },
  fr: {
    "reg.fullNamePh": "Ex. : Marie Jeanne Silva", "reg.fullNameHint": "Écrivez le nom exactement comme sur votre pièce d’identité.",
    "reg.emailPh": "exemple@email.com", "reg.emailHint": "Nous enverrons un code de confirmation à cet e-mail.",
    "reg.passwordPh": "Au moins 12 caractères", "reg.passwordHint": "Utilisez au moins 12 caractères, avec lettres, chiffres et symboles.",
    "reg.countryPh": "Sélectionnez le pays", "reg.countryHint": "Le pays où vous vivez actuellement.", "reg.common": "Les plus courants", "reg.all": "Tous les pays",
    "v.title": "Vérifier votre compte", "v.step1": "E-mail", "v.step2": "Documents", "v.step3": "Examen",
    "v.emailTitle": "Confirmez votre e-mail", "v.emailSent": "Nous avons envoyé un code à 6 chiffres à {email}. Cela peut prendre une minute ; vérifiez aussi les spams.",
    "v.emailAsk": "Nous enverrons un code à 6 chiffres à {email}.", "v.send": "Envoyer le code", "v.sending": "Envoi…",
    "v.codeLabel": "Code à 6 chiffres", "v.codeHint": "Le code est valable 15 minutes.", "v.confirm": "Confirmer l’e-mail", "v.confirming": "Confirmation…",
    "v.resend": "Renvoyer le code", "v.resendIn": "Renvoyer dans {s}s",
    "v.docsTitle": "Envoyez votre document", "v.docsBody": "Prenez des photos nettes, bien éclairées et sans reflets. Seule l’équipe de vérification voit les documents.",
    "v.docType": "Type de document", "v.doc.ID_CARD": "Carte d’identité", "v.doc.PASSPORT": "Passeport", "v.doc.RESIDENCE_PERMIT": "Titre de séjour",
    "v.issuing": "Pays émetteur du document", "v.front": "Recto du document", "v.back": "Verso du document", "v.selfie": "Selfie avec le document",
    "v.frontHint": "Tous les coins visibles et texte lisible.", "v.backHint": "Photographiez le verso de la carte.", "v.selfieHint": "Votre visage et le document doivent figurer sur la même photo.",
    "v.take": "Prendre une photo ou choisir", "v.change": "Changer", "v.submit": "Envoyer pour examen", "v.submitting": "Envoi…",
    "v.pendingTitle": "Compte en cours de vérification", "v.pendingBody": "Nous avons reçu vos documents. Notre équipe va les examiner et vous serez notifié. En attendant, vous pouvez utiliser le tableau de bord.",
    "v.approvedTitle": "Compte vérifié", "v.approvedBody": "Votre identité a été confirmée.",
    "v.rejectedTitle": "Vérification refusée", "v.rejectedBody": "Motif : {reason}. Vous pouvez envoyer de nouveaux documents.", "v.rejectedNoReason": "Vous pouvez envoyer de nouveaux documents.",
    "v.dashboard": "Aller au tableau de bord", "v.later": "Plus tard",
    "e.invalidCode": "Code incorrect.", "e.expiredCode": "Le code a expiré. Demandez-en un nouveau.", "e.tooMany": "Trop de tentatives. Attendez une minute.",
    "e.network": "Pas de connexion. Réessayez.", "e.generic": "Une erreur est survenue. Réessayez.", "e.required": "Toutes les photos demandées sont nécessaires.",
    "e.notImage": "Choisissez une photo (JPG ou PNG).", "e.notVerified": "Confirmez d’abord votre e-mail.", "e.mail": "Impossible d’envoyer l’e-mail pour l’instant. Réessayez plus tard.",
    "b.verifyEmail": "Compte en vérification : confirmez votre e-mail", "b.sendDocs": "Compte en vérification : envoyez votre pièce et un selfie", "b.pending": "Compte en vérification : documents en cours d’examen",
    "b.rejected": "Vérification refusée. Envoyez de nouveaux documents", "b.action": "Continuer",
  },
};

export function copyFor(language: LanguageCode) {
  const dict = COPY[language] ?? COPY.pt;
  return (key: string, params?: Record<string, string>): string => {
    let text = dict[key] ?? COPY.pt[key] ?? key;
    if (params) for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, v);
    return text;
  };
}

export function useCopy() {
  const { language } = useI18n();
  return copyFor(language);
}
