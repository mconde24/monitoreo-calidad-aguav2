# AQUATRACE · Panel de la estación

## Instalar en GitHub Pages

1. Extrae el ZIP.
2. Copia el contenido de la carpeta `aquatrace` a la raíz publicada de tu repositorio `monitoreo-calidad-agua`: reemplaza `index.html`, `styles.css` y `app.js`; añade `station.js` y la carpeta `assets` completa. No subas la carpeta `aquatrace` como un nivel adicional.
3. Confirma los cambios y espera a que GitHub Pages termine el despliegue.
4. Abre https://mconde24.github.io/monitoreo-calidad-agua/ y recarga con Ctrl+F5.

No necesitas instalar paquetes, compilar ni añadir API keys. Los cambios no se han enviado a tu repositorio desde esta conversación.

## Organización

El banner muestra el nombre AQUATRACE y «Estación Uninorte · Sensor 01», con las dos fotografías que compartiste. El nombre se cambia en `station.js`.

Las dos pestañas separan las funciones:

- Medidores y estación: últimas lecturas, fechas individuales, botón de consulta y mapa.
- Series de tiempo y análisis: consulta histórica, selección de segmento, estadísticas y exportación.

Los medidores se consultan cada 30 segundos y son independientes del historial. Se busca el último valor válido de cada variable en los últimos 100 registros de ThingSpeak. Si un campo no contiene ningún valor válido en esos registros, se informa en su tarjeta. Tras 15 minutos sin una nueva lectura, se indica «Dato antiguo»; puedes ajustar `staleAfterMinutes` en `station.js`.

## Calcular medias y medianas

1. Abre «Series de tiempo y análisis».
2. Elige el historial a cargar: última hora, 6 horas, 24 horas, 7 días o fechas específicas. Pulsa «Cargar historial» si cambias el periodo.
3. Define el inicio y fin del segmento en los campos del análisis y pulsa «Calcular». También puedes arrastrar horizontalmente sobre el área de una gráfica; el mismo segmento queda sombreado en las ocho series. En el móvil, los campos de fecha ofrecen una alternativa precisa al arrastre.
4. Consulta n, media, mediana, mínimo y máximo por variable.
5. Usa «Estadísticas CSV» para exportar la tabla del segmento. «CSV del historial» exporta las lecturas del intervalo cargado completo.
6. «Todo el historial cargado» restablece el segmento a los límites originales de la consulta.

Las fechas de los formularios se interpretan en Colombia (UTC−5) aunque el navegador esté en otro país. Las fechas de los CSV están en ISO UTC. Se incluyen los extremos del intervalo seleccionado.

La media es aritmética y asigna igual peso a cada lectura válida, sin interpolar ni ponderar por tiempo. La mediana usa el valor central, o el promedio de los dos centrales cuando n es par. Los campos vacíos y no numéricos se omiten; los ceros sí se incluyen. Sin datos, la tabla muestra n=0 y guiones para las estadísticas.

No se aplican promedios a los datos solicitados a ThingSpeak: las estadísticas se calculan localmente sobre las lecturas recibidas. Los resultados se muestran con hasta dos decimales, excepto gravedad específica (cuatro); el CSV conserva la precisión numérica disponible.

El historial permanece fijo tras cargarlo, para que el análisis no cambie durante la selección. Para traer nuevas lecturas a las series, pulsa «Cargar historial». Sólo los medidores tienen consulta automática.

## Cobertura y límites

ThingSpeak permite hasta 8000 registros por consulta. Al alcanzar ese número, el panel advierte que el historial y sus estadísticas pueden estar incompletos; reduce el intervalo. No hay paginación automática. Se permiten consultas de hasta un año por vez. La primera y última lectura dentro del segmento se muestran junto a sus límites, para distinguir el intervalo solicitado de la cobertura real.

Las gráficas muestran lecturas individuales. Su relleno no representa incertidumbre ni una banda mínimo–máximo. Los arcos y colores de los medidores representan la escala configurada y la identidad de la variable; no son umbrales ambientales.

## Mapa y configuración

El mapa utiliza OpenStreetMap y no requiere API key. La posición de referencia de la piscina del Centro Deportivo Roble Amarillo es:

- Latitud: 11.01947°
- Longitud: −74.84595°

Fuente cartográfica: https://www.openstreetmap.org/way/1476599457
Consulta secundaria: https://mapcarta.com/es/W1476599457
Referencia institucional del recinto: https://www.uninorte.edu.co/web/dunord/centro-deportivo-roble-amarillo

Es una ubicación cartográfica de referencia del recinto, no una medición GPS del sensor ni una posición recuperada de ThingSpeak. Ajusta las coordenadas en `station.js` cuando dispongas del punto de instalación medido.

En `station.js` puedes cambiar nombre, canal público, ubicación y antigüedad de los datos. En `app.js`, el arreglo `variables` contiene los campos, unidades, colores y escalas recibidos en el proyecto original. Verifica su correspondencia con los sensores. No coloques credenciales en ninguno de estos archivos: todo lo servido por GitHub Pages es público.

Los mapas dependen de OpenStreetMap; las gráficas, de Chart.js 4.4.8 mediante CDN. Se necesita conexión a Internet. Las fotos están incluidas localmente en `assets` y se presentan mediante HTML/CSS, sin generar imágenes nuevas.

## Verificación realizada

Sintaxis JavaScript y pruebas con respuestas simuladas: medias y medianas pares e impares, límites inclusivos, ceros y nulos, rangos inválidos, zona horaria, exportaciones CSV, pestañas, independencia de medidores e históricos, fallos de red y configuración del mapa. También se revisaron los enlaces locales y la ausencia de claves en las solicitudes. No se realizó una prueba visual en navegador en este entorno.
