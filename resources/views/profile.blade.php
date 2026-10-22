@extends('layouts.app')
@section('content')
<section class="page-hero">
    <p class="eyebrow">MI CUENTA</p>
    <h1>Tu perfil <em>Dragons.</em></h1>
    <p>Actualiza tus datos personales y tu foto de perfil.</p>
</section>
<section class="profile-page">
    <aside class="profile-card">
        <div class="large-avatar" data-profile-avatar>DV</div>
        <h2 data-profile-name>Tu nombre</h2>
        <p data-profile-email>correo@ejemplo.com</p>
    </aside>
    <div class="settings-grid">
        <form id="profile-details-form" class="settings-card">
            <p class="eyebrow">DATOS PERSONALES</p>
            <h3>Nombre y correo</h3><label>Nombre<input name="name" required></label><label>Correo electrónico<input name="email" type="email" required></label><button class="button primary">Guardar cambios →</button>
        </form>
        <form id="password-form" class="settings-card">
            <p class="eyebrow">SEGURIDAD</p>
            <h3>Cambiar contraseña</h3><label>Nueva contraseña<input name="password" type="password" minlength="8" required></label><button class="button primary">Actualizar contraseña →</button>
        </form>
        <form id="profile-photo-form" class="settings-card">
            <p class="eyebrow">IMAGEN</p>
            <h3>Foto de perfil</h3><label>Seleccionar imagen<input name="avatar" type="file" accept="image/*" required></label><button class="button primary">Subir foto →</button>
        </form>
    </div>
</section>
@endsection