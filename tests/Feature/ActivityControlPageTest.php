<?php

namespace Tests\Feature;

use Tests\TestCase;

class ActivityControlPageTest extends TestCase
{
    public function test_activity_page_and_navigation_are_available(): void
    {
        $this->get('/control-de-actividades')->assertOk()
            ->assertSee('id="activity-control"', false)
            ->assertSee('Nombre de la actividad')
            ->assertSee('data-activity-editor', false);
        $this->get('/')->assertOk()->assertSee('href="'.route('activities').'"', false);
    }
}
