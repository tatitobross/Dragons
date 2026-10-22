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
<div id="player-card-modal" class="player-card-backdrop">
    <form id="roster-player-form" class="player-card"><button type="button" class="player-card-close" aria-label="Cerrar">×</button>
        <div class="player-card-icon">＋</div>
        <p class="eyebrow">PLANTILLA DRAGONS</p>
        <h2>Agregar jugador</h2>
        <p>Este nombre aparecerá en cada nueva lista de asistencia.</p><label>Nombre completo del jugador<input name="name" required autofocus placeholder="Ej. Carlos López"></label>
        <div class="player-card-actions"><button type="button" class="button cancel-player-card">Cancelar</button><button class="button primary">Agregar a la lista →</button></div>
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