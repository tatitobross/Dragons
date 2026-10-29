export function validateCompetitionImage(file) {
    if (!file || !file.size) throw new Error('Selecciona una foto para la competencia.');
    if (!String(file.type || '').startsWith('image/')) throw new Error('El archivo de la competencia debe ser una imagen.');
    if (file.size > 10 * 1024 * 1024) throw new Error('La foto de la competencia no puede superar los 10 MB.');
    return file;
}
