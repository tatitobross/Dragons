@extends('layouts.app')
@section('content')
<section class="hero">
    <div class="hero-content">
        <p class="eyebrow">AGENDA DRAGONS</p>
        <h1>Lo que viene<br>en el <em>club.</em></h1>
        <p class="hero-copy">Entrenamientos, partidos, reuniones y cada momento importante de los atletas.</p>
    </div>
    <div class="hero-art"><img src="{{ asset('images/dragons-logo.png') }}" alt="Dragons VC" class="hero-logo"></div>
</section>
<section class="section events">
    <div class="section-heading split">
        <div>
            <p class="eyebrow">ENTRENOS FIJOS</p>
            <h2>Nos vemos en<br><em>la cancha.</em></h2>
        </div>
        <p class="text-link">Gimnasio Municipal de SRC</p>
    </div>
    <div class="event-cards">
        <article class="event-card feature">
            <div class="date-block"><b>MAR</b><span>Y JUE</span></div>
            <p class="tag">ENTRENAMIENTO</p>
            <h3 data-training-week-title>Práctica de equipo</h3>
            <p data-training-week>Gimnasio Municipal de SRC · 7:00 – 8:00 PM</p><button data-modal="question">Preguntar sobre el entreno →</button>
        </article>
        <article class="event-card">
            <div class="date-block"><b>DOM</b><span>SEMANAL</span></div>
            <p class="tag">ENTRENO Y PARTIDOS</p>
            <h3 data-training-sunday-title>Domingo Dragons</h3>
            <p data-training-sunday>Gimnasio Municipal de SRC · 7:00 – 10:00 PM</p><button data-modal="question">Ver detalles →</button>
        </article>
        <article class="event-card dark">
            <p class="tag">PRÓXIMAMENTE</p>
            <h3>Nuevos partidos.</h3>
            <p>El entrenador podrá agregar cada evento desde su panel.</p><a class="circle-link" href="{{ route('member') }}">→</a>
        </article>
    </div>
    <div id="custom-agenda" class="custom-agenda"></div>
</section>
@endsection