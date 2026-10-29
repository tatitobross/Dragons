@extends('layouts.app')
@section('content')
<section class="page-hero">
    <p class="eyebrow">CONTROL DE ENTRENOS</p>
    <h1>Asistencia de los <em>atletas.</em></h1>
    <p>Jugadores y entrenador pueden consultar el registro. Solo el entrenador puede editarlo.</p>
</section>
<section class="attendance-page member-area">
    <form id="attendance-session-form" class="admin-only attendance-create"><label>Fecha del entreno<input type="date" name="date" required></label><button class="button primary">Crear lista de asistencia →</button></form><button id="attendance-add-player" class="floating-player-button admin-only" title="Agregar jugador">＋<span>Agregar jugador</span></button>
    <div id="attendance-list" class="attendance-list"></div>
</section>
@include('partials.roster-player-modal')
<div id="attendance-player-remove-modal" class="player-card-backdrop">
    <form id="attendance-player-remove-form" class="player-card" role="dialog" aria-modal="true" aria-labelledby="attendance-player-remove-title">
        <button type="button" class="player-card-close" data-cancel-attendance-remove aria-label="Cerrar">×</button>
        <p class="eyebrow">LISTA DE ASISTENCIA</p>
        <h2 id="attendance-player-remove-title">Quitar jugador</h2>
        <p><strong data-attendance-remove-name></strong> dejará de aparecer en esta lista y en los entrenos desde el <strong data-attendance-remove-date></strong> en adelante. Las listas anteriores conservarán su historial y su cuenta seguirá igual.</p>
        <input type="hidden" name="playerId"><input type="hidden" name="sessionId">
        <div class="player-card-actions"><button type="button" class="button" data-cancel-attendance-remove>Cancelar</button><button type="submit" class="button attendance-delete-session">Sí, quitar jugador</button></div>
    </form>
</div>
<div id="attendance-session-modal" class="player-card-backdrop">
    <form id="attendance-session-edit-form" class="player-card admin-edit-card" role="dialog" aria-modal="true" aria-labelledby="attendance-session-title">
        <button type="button" class="player-card-close" data-close-attendance-session aria-label="Cerrar">×</button>
        <div class="player-card-icon">✎</div>
        <p class="eyebrow">LISTA DE ASISTENCIA</p>
        <h2 id="attendance-session-title">Cambiar fecha</h2>
        <p data-attendance-session-copy></p>
        <label data-attendance-session-date>Fecha del entreno<input type="date" name="date" required></label>
        <div class="player-card-actions"><button type="button" class="button" data-close-attendance-session>Cancelar</button><button type="submit" class="button primary" data-attendance-session-save>Guardar fecha →</button></div>
    </form>
</div>
<div id="debt-card-modal" class="player-card-backdrop">
    <form id="debt-card-form" class="player-card debt-card"><button type="button" class="debt-card-close player-card-close" aria-label="Cerrar">×</button>
        <div class="player-card-icon">L</div>
        <p class="eyebrow">CONTROL DE PAGO</p>
        <h2>Registrar deuda</h2>
        <p>Indica el monto pendiente de este jugador para este entreno.</p><label>Monto pendiente (L)<input name="amount" required type="number" min="0.01" step="0.01" placeholder="Ej. 50.00"></label>
        <div class="player-card-actions"><button type="button" class="button cancel-debt-card">Cancelar</button><button class="button primary">Guardar deuda →</button></div>
    </form>
</div>
@endsection
