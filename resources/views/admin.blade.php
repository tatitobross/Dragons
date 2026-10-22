@extends('layouts.app')
@section('content')
<section class="page-hero admin-only">
    <p class="eyebrow">PANEL DEL ENTRENADOR</p>
    <h1>Administración <em>total.</em></h1>
    <p>Crea, edita, elimina y consulta todo el contenido público y privado.</p>
</section>
<section class="admin-hub admin-only">
    <div class="admin-tools">
        <form id="savings-form">
            <p class="tag">AHORROS</p>
            <p class="admin-savings-current">Saldo publicado <strong data-admin-savings-value>L 18,450.00</strong></p><label>Monto total (L)<input name="amount" required type="number" min="0" step="0.01" placeholder="Ej. 18450.00"></label><button class="button primary">Actualizar ahorro →</button>
        </form>
        <form id="contact-form">
            <p class="tag">CONTACTO</p><input name="phone" required placeholder="Teléfono"><input name="email" required type="email" placeholder="Correo"><input name="coach" required placeholder="Entrenador"><button class="button primary">Guardar contactos →</button>
        </form>
        <form id="site-form">
            <p class="tag">LANDING Y CLUB</p><input name="heroTitle" required placeholder="Título principal"><textarea name="heroCopy" required placeholder="Mensaje principal"></textarea><textarea name="vision" required placeholder="Visión"></textarea><textarea name="mission" required placeholder="Misión"></textarea><button class="button primary">Guardar sitio →</button>
        </form>
        <form id="training-form">
            <p class="tag">ACTIVIDADES DESTACADAS</p><label>Etiqueta pequeña 1<input name="trainingWeekLabel" required placeholder="Ej. Entreno, cena, reunión"></label><label>Nombre de actividad 1<input name="trainingWeekTitle" required placeholder="Ej. Práctica de equipo"></label><label>Detalle de actividad 1<input name="trainingWeek" required placeholder="Ej. Gimnasio · 7:00 PM"></label><label>Etiqueta pequeña 2<input name="trainingSundayLabel" required placeholder="Ej. Partido, convivencia"></label><label>Nombre de actividad 2<input name="trainingSundayTitle" required placeholder="Ej. Entreno y partidos"></label><label>Detalle de actividad 2<input name="trainingSunday" required placeholder="Ej. Gimnasio · 7:00 PM"></label><button class="button primary">Actualizar actividades →</button>
        </form>
        <form id="notice-form">
            <p class="tag">COMUNICADO</p><input name="title" required placeholder="Título"><textarea name="body" required placeholder="Mensaje"></textarea><button class="button primary">Publicar comunicado →</button>
        </form>
        <form id="agenda-form">
            <p class="tag">EVENTO / AGENDA</p><input name="title" required placeholder="Nombre"><input name="when" required placeholder="Fecha y hora"><input name="place" required placeholder="Lugar"><textarea name="description" placeholder="Descripción"></textarea><button class="button primary">Agregar evento →</button>
        </form>
        <form id="competition-form">
            <p class="tag">COMPETENCIA ACTUAL</p><input name="title" required placeholder="Torneo"><input name="date" required placeholder="Fecha"><label>Foto de la competencia (opcional; solo se muestra en Competencias)<input name="competitionImage" type="file" accept="image/*"></label><textarea name="description" required placeholder="Información"></textarea><button class="button primary">Publicar y reemplazar competencia →</button>
        </form>
        <form id="gallery-upload-form">
            <p class="tag">GALERÍA</p><input name="caption" required placeholder="Título"><textarea name="description" placeholder="Descripción"></textarea><label>Archivo<input type="file" name="media" required accept="image/*,video/*"></label><button class="button primary">Subir publicación →</button>
        </form>
    </div>
    <div class="admin-records">
        <h2>Todo lo publicado</h2>
        <div id="admin-record-list"></div>
    </div>
</section>
@endsection