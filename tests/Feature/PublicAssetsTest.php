<?php

namespace Tests\Feature;

use DOMDocument;
use Tests\TestCase;

class PublicAssetsTest extends TestCase
{
    public function test_competition_does_not_reference_a_missing_local_image(): void
    {
        $response = $this->get('/competencias')->assertOk();
        $document = new DOMDocument();
        @$document->loadHTML($response->getContent());
        foreach ($document->getElementsByTagName('img') as $image) {
            $path = parse_url($image->getAttribute('src'), PHP_URL_PATH);
            if (is_string($path) && str_starts_with($path, '/images/')) {
                $this->assertFileExists(public_path(ltrim($path, '/')));
            }
        }
        $response->assertSee('data-competition-media hidden', false);
    }
}
