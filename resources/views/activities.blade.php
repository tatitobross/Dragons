@extends('layouts.app')
@section('content')
<section class="page-hero">
    <p class="eyebrow">ENTREGAS Y PAGOS DEL CLUB</p>
    <h1>Control de <em>actividades.</em></h1>
    <p>Rifas y otras actividades: consulta quién tiene un pago pendiente y quién ya pagó. El entrenador administra cada lista.</p>
</section>
<section id="activity-control" class="attendance-page member-area">
    <form id="activity-create-form" class="activity-create admin-only">
        <p class="eyebrow">NUEVA ACTIVIDAD</p>
        <label>Nombre de la actividad<input name="title" maxlength="120" placeholder="Ej. Rifa del equipo" required></label>
        <label>Fecha (opcional)<input name="date" type="date"></label>
        <button type="submit" class="button primary">Crear actividad →</button>
    </form>
    <div data-activity-list aria-live="polite"></div>
    <div data-activity-modal class="player-card-backdrop">
        <form data-activity-editor class="player-card admin-edit-card" role="dialog" aria-modal="true" aria-labelledby="activity-editor-title">
            <button type="button" class="player-card-close" data-activity-close aria-label="Cerrar">×</button>
            <div class="player-card-icon">✎</div>
            <p class="eyebrow">CONTROL DE ACTIVIDADES</p>
            <h2 id="activity-editor-title">Editar actividad</h2>
            <p data-activity-editor-copy></p>
            <div data-activity-editor-fields></div>
            <div class="player-card-actions"><button type="button" class="button" data-activity-close>Cancelar</button><button type="submit" class="button primary" data-activity-save>Guardar cambios →</button></div>
        </form>
    </div>
</section>
@endsection
