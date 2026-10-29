<div id="player-card-modal" class="player-card-backdrop">
    <form id="roster-player-form" class="player-card">
        <button type="button" class="player-card-close" aria-label="Cerrar">×</button>
        <div class="player-card-icon">＋</div>
        <p class="eyebrow">PLANTILLA DE ASISTENCIA</p>
        <h2>Agregar atleta</h2>
        <p>Solo los atletas que el entrenador agregue aquí aparecerán en las listas de asistencia. No necesitan tener una cuenta en la página.</p>
        <label>Nombre completo del atleta<input name="name" required placeholder="Ej. Carlos López"></label>
        <div class="player-card-actions"><button type="button" class="button cancel-player-card">Cancelar</button><button class="button primary" type="submit">Agregar a la plantilla →</button></div>
    </form>
</div>
<div id="roster-remove-modal" class="player-card-backdrop">
    <form id="roster-remove-form" class="player-card">
        <button type="button" class="player-card-close" aria-label="Cerrar">×</button>
        <p class="eyebrow">PLANTILLA DE ASISTENCIA</p>
        <h2>Retirar atleta</h2>
        <p>¿Retirar a <strong data-roster-remove-name></strong> de la plantilla? Su historial se conservará y esto no cambia ninguna cuenta de acceso.</p>
        <input type="hidden" name="playerId">
        <div class="player-card-actions"><button type="button" class="button cancel-roster-remove">Cancelar</button><button class="button primary" type="submit">Retirar de la plantilla</button></div>
    </form>
</div>
