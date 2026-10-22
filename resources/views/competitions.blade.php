@extends('layouts.app')
@section('content')
<section class="hero">
    <div class="hero-content">
        <p class="eyebrow">EN LA CANCHA</p>
        <h1>Competimos para<br><em>superarnos.</em></h1>
        <p class="hero-copy">Conoce la competencia activa de Dragons VC.</p>
    </div>
    <div class="hero-art"><img src="{{ asset('images/dragons-logo.png') }}" alt="Logo Dragons VC" class="hero-logo"></div>
</section>
<section class="tournament competition-detail">
    <div class="tournament-copy">
        <p class="eyebrow">COMPETENCIA ACTUAL</p>
        <p class="competition-date" data-competition-date>31 DE OCTUBRE</p>
        <h2 data-competition-title>Torneo de las <em>Estrellas.</em></h2>
        <p data-competition-copy>Conoce la información del próximo reto de los atletas Dragons.</p>
    </div>
    <div class="competition-image-wrap"><img data-competition-image src="{{ asset('images/juego-estrellas.png') }}" alt="Foto de la competencia actual"></div>
</section>
@endsection