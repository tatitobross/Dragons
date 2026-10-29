<?php

namespace Tests\Feature;

use Dotenv\Dotenv;
use Tests\TestCase;

class ProductionConfigurationTest extends TestCase
{
    public function test_production_template_disables_debug_and_uses_private_file_services(): void
    {
        $values = Dotenv::parse(file_get_contents(base_path('.env.production.example')));

        $this->assertSame('production', $values['APP_ENV']);
        $this->assertSame('false', $values['APP_DEBUG']);
        $this->assertStringStartsWith('https://', $values['APP_URL']);
        $this->assertSame('', $values['APP_KEY']);
        $this->assertSame('file', $values['SESSION_DRIVER']);
        $this->assertSame('file', $values['CACHE_STORE']);
        $this->assertSame('sync', $values['QUEUE_CONNECTION']);
        $this->assertSame('true', $values['SESSION_SECURE_COOKIE']);
    }

    public function test_site_runs_with_production_template_services_without_a_sqlite_database(): void
    {
        $values = Dotenv::parse(file_get_contents(base_path('.env.production.example')));
        config([
            'app.env' => $values['APP_ENV'],
            'app.debug' => $values['APP_DEBUG'] === 'true',
            'session.driver' => $values['SESSION_DRIVER'],
            'session.secure' => $values['SESSION_SECURE_COOKIE'] === 'true',
            'cache.default' => $values['CACHE_STORE'],
            'queue.default' => $values['QUEUE_CONNECTION'],
            'database.connections.sqlite.database' => base_path('database/deployment-test-must-not-exist.sqlite'),
        ]);

        $this->get('/')->assertOk();
        $this->get('/recuperar-contrasena')->assertOk();
    }

    public function test_new_local_installations_do_not_require_sql_services(): void
    {
        $values = Dotenv::parse(file_get_contents(base_path('.env.example')));

        $this->assertSame('file', $values['SESSION_DRIVER'] ?? null);
        $this->assertSame('file', $values['CACHE_STORE'] ?? null);
        $this->assertSame('sync', $values['QUEUE_CONNECTION'] ?? null);
    }
}
