@extends('layouts.app')
@section('content')
<section class="page-hero">
    <p class="eyebrow">ZONA PRIVADA</p>
    <h1>Espacio de los <em>atletas.</em></h1>
    <p>Comunicados y datos internos del club.</p>
</section>
<section class="member-area private-space">
    <div id="ahorros" class="member-panel savings-panel">
        <div>
            <p class="eyebrow">AHORROS DEL CLUB</p>
            <h3 data-savings-value>Protegido</h3>
            <p data-savings-message>Solicita un enlace temporal a tu correo para desbloquear esta información.</p>
        </div><button class="button primary" data-private-token>Enviar enlace al correo →</button>
    </div>
    <div id="comunicados" class="member-panel notices-panel">
        <div class="panel-title">
            <div>
                <p class="eyebrow">COMUNICADOS</p>
                <h3>La voz del equipo</h3>
            </div><span class="role-chip">INTERNO</span>
        </div>
        <div class="notice-list" id="notice-list"></div>
    </div>
</section>
@endsection