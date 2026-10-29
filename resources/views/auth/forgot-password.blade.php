@extends('layouts.app')
@section('content')
<section class="password-recovery-page">
    <article class="password-recovery-panel">
        <p class="eyebrow">RECUPERAR ACCESO</p>
        <h1>Recupera tu <em>contraseña.</em></h1>
        <p>Escribe el correo registrado en tu cuenta de Dragons VC. Recibirás un enlace para elegir una nueva contraseña.</p>
        <form id="password-reset-form">
            <label>Correo registrado<input required name="email" type="email" autocomplete="email" placeholder="correo@ejemplo.com"></label>
            <button class="button primary" type="submit">Enviar enlace al correo →</button>
        </form>
        <p id="password-reset-feedback" class="password-reset-feedback" role="status" aria-live="polite" hidden></p>
        <p class="password-recovery-help">Revisa también la carpeta de spam. Al cambiar tu contraseña conservarás tu cuenta y tus permisos.</p>
        <a class="inline-button password-recovery-link" href="{{ route('home') }}">← Volver al inicio</a>
    </article>
</section>
@endsection
