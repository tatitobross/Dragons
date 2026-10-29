<?php

use Illuminate\Support\Facades\Route;

Route::view('/', 'welcome')->name('home');
Route::view('/recuperar-contrasena', 'auth.forgot-password')->name('password.request');
Route::view('/competencias', 'competitions')->name('competitions');
Route::view('/galeria', 'gallery')->name('gallery');
Route::view('/espacio', 'member')->name('member');
Route::view('/perfil', 'profile')->name('profile');
Route::view('/administracion', 'admin')->name('admin');
Route::view('/jugadores', 'players')->name('players');
Route::view('/asistencia', 'attendance')->name('attendance');
Route::view('/control-de-actividades', 'activities')->name('activities');
