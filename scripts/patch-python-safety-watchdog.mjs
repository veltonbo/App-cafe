// The standalone Python Smart Life watchdog is intentionally disabled.
// It created a second tuya-sharing Manager using the same Smart Life session,
// which can compete with the main bridge for token refresh/cache updates and
// make EKAZA/Weather2-2 appear offline or unconfirmed.
//
// Safety remains enforced by the main controller's priority OFF path and the
// Python primary decision engine, but there is now exactly one Smart Life
// session owner inside the application.
console.log('[Fazenda 2E] Python Smart Life watchdog desativado: sessão Smart Life única para evitar concorrência.');
