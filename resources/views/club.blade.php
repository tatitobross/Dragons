@extends('layouts.app')
@section('content')
<section class="club-story">
    <div class="club-logo-wrap"><img src="{{ asset('images/dragons-logo.png') }}" alt="Dragons VC"></div>
    <div class="club-copy">
        <p class="eyebrow">NUESTRA IDENTIDAD</p>
        <h2>Más que un club.<br><em>Atletas unidos.</em></h2>
        <p>Dragons VC nace para reunir personas que aman el volleyball y creen en la disciplina, el respeto y el trabajo en equipo.</p>
        <div class="mission-grid">
            <article><span>01</span>
                <h3>Visión</h3>
                <p data-vision>Ser un referente de volleyball que inspira a nuevas generaciones a creer en el poder del equipo.</p>
            </article>
            <article><span>02</span>
                <h3>Misión</h3>
                <p data-mission>Formar atletas íntegros mediante entrenamiento, respeto, compañerismo y pasión por el juego.</p>
            </article>
        </div>
    </div>
</section>
@endsection