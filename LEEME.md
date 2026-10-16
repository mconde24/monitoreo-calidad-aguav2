# AQUATRACE · Panel de la estación

## Instalar en GitHub Pages

1. Extrae el ZIP. Sus siete archivos están directamente en la raíz, sin carpetas adicionales.
2. Sube los siete archivos juntos a la raíz publicada del repositorio `monitoreo-calidad-agua` y reemplaza los anteriores. Los dos JPEG deben estar al mismo nivel que `index.html`.
3. Confirma los cambios y espera a que GitHub Pages termine el despliegue.
4. Abre https://mconde24.github.io/monitoreo-calidad-agua/ y recarga con Ctrl+F5.

Las fotos no aparecían porque estaban subidas en la raíz, mientras que el HTML anterior buscaba dentro de `assets`. Esta versión usa rutas directas a `aquatrace-sensores.jpeg` y `entorno-estacion.jpeg`. También admite `assets` como ruta alternativa si se conserva la estructura anterior.

No necesitas instalar paquetes, compilar ni añadir API keys. Los cambios no se han enviado a tu repositorio desde esta conversación.

## Organización

El banner muestra el nombre AQUATRACE y «Estación Uninorte · Sensor 01», con las dos fotografías que compartiste. El nombre se cambia en `station.js`.

Las dos pestañas separan las funciones:

- Medidores y estación: últimas lecturas, fechas individuales, botón de consulta y mapa.
- Series de tiempo y análisis: consulta histórica, selección de segmento, estadísticas y exportación.

Los medidores se consultan cada 30 segundos y son independientes del historial. Se busca el último valor válido de cada variable en los últimos 100 registros de ThingSpeak. Si un campo no contiene ningún valor válido en esos registros, se informa en su tarjeta. Tras 15 minutos sin una nueva lectura, se indica «Dato antiguo»; puedes ajustar `staleAfterMinutes` en `station.js`.

## Calcular medias y medianas

1. Abre «Series de tiempo y análisis».
2. Elige el historial a cargar: última hora, 6 horas, 24 horas, 7 días o fechas específicas. Los periodos predefinidos se cargan automáticamente al cambiarlos. Para fechas específicas, pulsa «Cargar historial».
3. Define el inicio y fin del segmento en los campos del análisis y pulsa «Calcular». También puedes arrastrar horizontalmente sobre el área de una gráfica; el mismo segmento queda sombreado en las ocho series. En el móvil, los campos de fecha ofrecen una alternativa precisa al arrastre.
4. Consulta n, media y mediana en la tabla lateral. El CSV de estadísticas también incluye mínimo y máximo por variable.
5. Usa «Estadísticas CSV» para exportar la tabla del segmento. «CSV del historial» exporta las lecturas del intervalo cargado completo.
6. «Todo el historial cargado» restablece el segmento a los límites originales de la consulta.

Las fechas de los formularios se interpretan en Colombia (UTC−5) aunque el navegador esté en otro país. Las fechas de los CSV están en ISO UTC. Se incluyen los extremos del intervalo seleccionado.

La media es aritmética y asigna igual peso a cada lectura válida, sin interpolar ni ponderar por tiempo. La mediana usa el valor central, o el promedio de los dos centrales cuando n es par. Los campos vacíos y no numéricos se omiten; los ceros sí se incluyen. Sin datos, la tabla muestra n=0 y guiones para las estadísticas.

No se aplican promedios a los datos solicitados a ThingSpeak: las estadísticas se calculan localmente sobre las lecturas recibidas. Los resultados se muestran con hasta dos decimales, excepto gravedad específica (cuatro); el CSV conserva la precisión numérica disponible.

El historial permanece fijo tras cargarlo, para que el análisis no cambie durante la selección. Para traer nuevas lecturas a las series, pulsa «Cargar historial». Sólo los medidores tienen consulta automática.

## Cobertura y límites

ThingSpeak permite hasta 8000 registros por consulta. Al alcanzar ese número, el panel advierte que el historial y sus estadísticas pueden estar incompletos; reduce el intervalo. No hay paginación automática. Se permiten consultas de hasta un año por vez. La primera y última lectura dentro del segmento se muestran junto a sus límites, para distinguir el intervalo solicitado de la cobertura real.

Las gráficas muestran lecturas individuales. Su relleno no representa incertidumbre ni una banda mínimo–máximo. El arco interior representa la escala del instrumento y la identidad de la variable. Una banda exterior separada muestra la referencia ecológica aplicable. El color del valor por sí solo identifica la variable y no su calidad.

## Mapa y configuración

El mapa utiliza OpenStreetMap y no requiere API key. La posición de referencia de la piscina del Centro Deportivo Roble Amarillo es:

- Latitud: 11.01947°
- Longitud: −74.84595°

Fuente cartográfica: https://www.openstreetmap.org/way/1476599457
Consulta secundaria: https://mapcarta.com/es/W1476599457
Referencia institucional del recinto: https://www.uninorte.edu.co/web/dunord/centro-deportivo-roble-amarillo

Es una ubicación cartográfica de referencia del recinto, no una medición GPS del sensor ni una posición recuperada de ThingSpeak. Ajusta las coordenadas en `station.js` cuando dispongas del punto de instalación medido.

En `station.js` puedes cambiar nombre, canal público, ubicación y antigüedad de los datos. En `app.js`, el arreglo `variables` contiene los campos, unidades, colores y escalas recibidos en el proyecto original. Verifica su correspondencia con los sensores. No coloques credenciales en ninguno de estos archivos: todo lo servido por GitHub Pages es público.

Los mapas dependen de OpenStreetMap; las gráficas, de Chart.js 4.4.8 mediante CDN. Se necesita conexión a Internet. Las fotos están incluidas localmente junto a `index.html` y se presentan mediante HTML/CSS, sin generar imágenes nuevas.

## Verificación realizada

Sintaxis JavaScript y pruebas con respuestas simuladas: medias y medianas pares e impares, límites inclusivos, ceros y nulos, rangos inválidos, zona horaria, exportaciones CSV, pestañas, independencia de medidores e históricos, fallos de red y configuración del mapa. También se revisaron los enlaces locales y la ausencia de claves en las solicitudes. Se probaron además los límites de las referencias ecológicas, los perfiles, la neutralización de la evaluación de datos antiguos y la ruta alternativa de las imágenes. No se realizó una prueba visual en navegador en este entorno.

## Legibilidad y referencias ecológicas

Se aumentó toda la interfaz: cuerpo principal a 16 px, pestañas a 18 px, títulos de sección a 26 px, valores de los medidores a 36 px en escritorio y ejes de gráficas a 14 px. Se ampliaron el banner, los controles, los medidores, el mapa y las series. En móvil se adapta el número de columnas.

El selector «Referencia ecológica de los medidores» permite elegir agua dulce, agua marina/estuarina o sin perfil definido. El valor inicial se configura con `defaultWaterProfile` en `station.js`. Las referencias se aplican a ecosistemas naturales, no a los requisitos sanitarios de una piscina ni a potabilidad.

Referencias implementadas:

- pH en agua dulce: 6,5–9. Se presenta verde dentro del intervalo y ámbar fuera de él.
- pH en agua marina/estuarina: 6,5–8,5 como referencia general de agua salada. En estuarios y otros ambientes con variación natural marcada se necesita un criterio específico del sitio.
- Oxígeno disuelto en el perfil de agua dulce: ≥5 mg/L como categoría alta; >3 y <5 mg/L como moderada; ≤3 mg/L como baja. Es una referencia orientativa procedente de una evaluación de lagos, no un límite universal para todas las especies o etapas de vida. En el perfil marino/estuarino no se aplican estas categorías de lagos.
- Conductividad, temperatura, sólidos disueltos, salinidad, gravedad específica y saturación: se muestra la necesidad de una referencia local; no se inventan intervalos saludables universales. Los rangos de escala del instrumento no se usan para declarar saludable el agua.

Una lectura antigua, inexistente o fuera de la escala configurada no se presenta como favorable. La banda de referencia puede seguir visible para explicar la escala, mientras que el mensaje del medidor informa el estado de la lectura.

La media, la mediana y los CSV siguen mostrando los valores recibidos; la incorporación de las bandas no filtra datos ni altera las mediciones.

Fuentes incluidas también en el apartado desplegable de la página:

- EPA, pH y criterios de vida acuática: https://www.epa.gov/wqc/national-recommended-water-quality-criteria-aquatic-life-criteria-table
- EPA, contexto del pH: https://www.epa.gov/caddis/ph
- EPA, categorías de oxígeno de National Lakes Assessment: https://archive.epa.gov/water/archive/web/html/lakessurvey_faq.html
- EPA, conductividad y línea base local: https://archive.epa.gov/water/archive/web/html/vms59.html

## Series protagonistas y ajuste de ejes (última revisión)

Las gráficas ocupan el área principal de la sección histórica. La tabla compacta de medias y medianas se sitúa en una barra lateral en escritorio; en pantallas pequeñas se coloca debajo. La unidad aparece junto al nombre de cada variable en la tabla y los extremos permanecen disponibles en el CSV.

En «Vista de las series», el eje de tiempo tiene cuatro modos:

- Automática · Historial consultado: muestra exactamente el inicio y fin del periodo cargado, incluidos los espacios sin mediciones.
- Automática · Datos disponibles: se ajusta a la primera y última lectura válida disponibles en el historial de cualquiera de las variables.
- Segmento del análisis: se ajusta al segmento elegido para las estadísticas; cuando cambias el segmento, también cambia la vista temporal.
- Manual · Definir fechas: permite escribir un inicio y fin dentro del historial cargado y aplicar la vista a todas las gráficas.

«Ver historial completo» restablece el eje de tiempo al intervalo consultado. Recortar la vista temporal por sí solo no cambia el segmento usado para calcular las estadísticas. El botón «Analizar todo el historial» restablece el segmento estadístico.

Cada gráfica tiene su propio control «Escala vertical»:

- Automática: Chart.js determina mínimo y máximo a partir de las lecturas cargadas, sin límites fijos del instrumento.
- Manual: escribe mínimo y máximo y pulsa «Aplicar». El mínimo debe ser menor que el máximo. Puedes volver a automática en cualquier momento.

Los límites manuales verticales se conservan al cargar otro historial para facilitar comparaciones. La escala automática se recalcula con el historial cargado; recortar sólo la ventana temporal no excluye lecturas de ese cálculo automático vertical.

Al cambiar un periodo predefinido (1 h, 6 h, 24 h o 7 días), el panel carga el historial automáticamente y actualiza la extensión temporal a ese periodo. Para fechas específicas, define los límites y pulsa «Cargar historial». Una carga correcta restablece el eje temporal al periodo nuevo y el segmento estadístico al historial completo; una carga fallida conserva los datos anteriores con su mensaje de error.

Se verificaron con respuestas simuladas los modos verticales automático/manual, la validación de límites, los cuatro modos temporales y el reajuste de la extensión al cambiar el historial, además de las comprobaciones descritas anteriormente.
