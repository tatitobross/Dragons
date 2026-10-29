<?php

namespace Tests\Feature;

use Tests\TestCase;

class PasswordRecoveryPageTest extends TestCase
{
    public function test_forgot_password_links_to_a_real_page(): void
    {
        $this->get('/')
            ->assertOk()
            ->assertSee('href="'.route('password.request').'"', false)
            ->assertSee('¿Olvidaste tu contraseña?');
    }

    public function test_recovery_page_is_public_and_contains_the_email_form(): void
    {
        $this->get('/recuperar-contrasena')
            ->assertOk()
            ->assertSee('id="password-reset-form"', false)
            ->assertSee('Correo registrado')
            ->assertSee('Enviar enlace al correo')
            ->assertSee('id="password-reset-feedback"', false);
    }
}
