@extends('layouts.app')
@section('content')
<section class="hero">
    <div class="hero-content">
        <p class="eyebrow">NUESTROS MOMENTOS</p>
        <h1>Galería de los<br><em>atletas.</em></h1>
        <p class="hero-copy">Fotos, videos, recuerdos y las historias detrás de cada jornada Dragons.</p><button class="button primary" data-modal="login">Entrar para participar →</button>
    </div>
    <div class="hero-art"><img src="{{ asset('images/dragons-logo.png') }}" alt="Dragons VC" class="hero-logo"></div>
</section>
<section class="section gallery">
    <div class="section-heading split">
        <div>
            <p class="eyebrow">PUBLICACIONES</p>
            <h2>Lo que vivimos<br><em>juntos.</em></h2>
        </div>
    </div>
    <div id="uploaded-gallery" class="gallery-grid">
        <p class="gallery-empty">Aún no hay publicaciones en la galería.</p>
    </div>
</section>
@endsection