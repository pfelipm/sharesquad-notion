[🇬🇧 English version](README.en.md)

# ShareSquad para Notion™

<p align="center"><img src="./readme-archivos/ES%20destacado.png" alt="Destacado de la extensión"></p>

## Descripción

ShareSquad for Notion es una extensión de Chrome diseñada para optimizar la forma en que colaboras con personas externas en Notion.

Para entender el valor que aporta, es importante conocer cómo Notion gestiona los accesos:
*   **Miembros (Members):** Tienen acceso a todo el espacio de trabajo. Suelen ser miembros del equipo interno, con permisos amplios para crear y editar, y cada uno representa un coste por puesto en el plan de facturación.
*   **Invitados (Guests):** Son colaboradores externos invitados únicamente a páginas específicas. Su acceso es limitado y, a menudo, resultan una opción más económica, ya que los planes de Notion suelen incluir un número de invitados gratuitos.

El resto surge cuando se necesita invitar repetidamente a los mismos grupos de colaboradores externos a diferentes páginas. Notion no ofrece una forma nativa de agrupar a estos invitados. **ShareSquad resuelve este problema** permitiéndote crear y gestionar "squads" (equipos) de invitados, para que puedas añadirlos a cualquier página de forma eficiente.

<p align="center"><img src="readme-archivos/ES%20recorrido.gif" alt="Recorrido de la interfaz de usuario"></p>

## Características y flujo de trabajo

La extensión ofrece dos modos de operación desde el panel lateral, ambos requieren que el usuario haya abierto previamente el cuadro de diálogo de compartir de Notion:

### 1. Inyección manual (botón "Inyectar")

Esta es la función principal y más estable.
*   **Flujo de trabajo:**
    1.  En la página de Notion, el usuario **debe hacer clic en "Share"** para abrir el cuadro de diálogo de compartir.
    2.  En el panel de la extensión, selecciona un grupo.
    3.  Haz clic en el botón **"Inyectar"**.
*   **Resultado:** La extensión pegará las direcciones de correo electrónico del grupo en el campo de invitación del cuadro de diálogo ya abierto. **Importante:** Los usuarios inyectados se añadirán a los permisos existentes; en ningún caso los reemplazarán. El usuario deberá hacer clic manualmente en el botón "Invite" de Notion para finalizar el proceso.

### 2. Sincronización automática (botón "Sincronizar permisos" - experimental)

Esta es la nueva función experimental, que automatiza parte del proceso.
*   **Flujo de trabajo:**
    1.  En la página de Notion, el usuario **debe hacer clic en "Share"** para abrir el cuadro de diálogo de compartir.
    2.  En el panel de la extensión, selecciona uno o más usuarios y/o grupos.
    3.  Haz clic en el nuevo botón **"Sincronizar permisos"**.
*   **Resultado:** La extensión simulará la introducción de las direcciones de correo en el cuadro de diálogo ya abierto y realizará los clics necesarios para enviar las invitaciones automáticamente.
*   **Comportamiento importante:**
    *   **Configuración de accesos:** A diferencia de la inyección manual, este modo permite que la extensión establezca también el **nivel de acceso** (por ejemplo, "Puede ver", "Puede editar") de los usuarios invitados, según lo definido en el panel lateral.
    *   **Proceso aditivo:** Se invitan a la página los nuevos usuarios de tu selección.
    *   **Modificación de permisos:** Si un usuario de tu selección ya ha sido invitado a la página, esta función puede **actualizar su nivel de acceso** (por ejemplo, de "Puede ver" a "Puede editar").
    *   **No eliminación:** Este proceso **nunca eliminará a un usuario** de la lista de acceso de la página, incluso si no forma parte de tu selección actual. Es una medida de seguridad para prevenir la eliminación accidental de accesos.

---

### Otras características

*   **Gestión de invitados y grupos:** Crea, edita y elimina perfiles de invitados (nombre y correo) y agrúpalos en "squads" reutilizables.
*   **Importación y exportación de datos:** Realiza copias de seguridad de tus invitados y grupos en un archivo JSON. Para facilitar la importación de equipos desde Google Groups™, puedes usar mi herramienta complementaria [ShareSquad Companion](https://github.com/pfelipm/sharesquad-notion-companion), que prepara tus listas de miembros en un formato compatible.
*   **Sincronización entre dispositivos:** Tus configuraciones se guardan y sincronizan a través de tu cuenta de Chrome.

## Detalles técnicos

*   **Arquitectura:** La extensión utiliza **Manifest V3**, con un *Service Worker* en segundo plano y la API de *Side Panel*.
*   **Ligera y rápida:** Construida con HTML, CSS y JavaScript puros, sin frameworks pesados, para un rendimiento óptimo.
*   **Almacenamiento:** Los datos de usuarios y grupos se sincronizan con tu cuenta de Google usando `chrome.storage.sync`, mientras que las preferencias de la aplicación (como el idioma) se guardan localmente con `chrome.storage.local`.
*   **Permisos requeridos:**
    *   `tabs`: Para verificar que te encuentras en una página de Notion.
    *   `scripting`: Necesario para que los botones "Inyectar" y "Sincronizar permisos" puedan interactuar con el cuadro de diálogo de compartir de Notion.
    *   `storage`: Para guardar y sincronizar tus listas de invitados y grupos.
    *   `sidePanel`: Para mostrar la interfaz de usuario de la extensión.
*   **ID de la extensión:** El archivo `manifest.json` incluye una clave (`key`) que garantiza que la extensión tenga siempre el mismo ID (**`ipckfikimemoffgmjbneepgfnagjjkgn`**), permitiendo que los datos sincronizados en la cuenta de Chrome sean accesibles desde cualquier instancia instalada manualmente.
*   **Advertencia sobre la función experimental:** La función del botón **"Sincronizar permisos"** es experimental porque manipula directamente el DOM (la estructura interna) del cuadro de diálogo de compartir de Notion. Si Notion cambia su diseño, este botón podría dejar de funcionar. El botón "Inyectar" es más simple y tiene más probabilidades de seguir funcionando tras futuras actualizaciones de Notion.

## Instalación (modo desarrollador)

> [!WARNING]
> **Importante sobre la persistencia de datos:** Al desinstalar manualmente cualquier instancia de la extensión instalada en modo desarrollador, Google eliminará todos los datos asociados de la nube. **Realiza siempre una exportación de tus datos** antes de desinstalar la extensión para no perder tus listas de usuarios y grupos.

Al ser una extensión experiemental, la instalación se realiza de forma manual:

1.  **Descarga el repositorio:** Haz clic en el botón `Code` → `Download ZIP`. Alternativamente, puedes clonar el repositorio usando `git clone https://github.com/pfelipm/sharesquad-notion.git`.
2.  **Descomprime el archivo:** Extrae el contenido del ZIP en una carpeta permanente en tu ordenador.
3.  **Abre las extensiones de Chrome:** Ve a `chrome://extensions`.
4.  **Activa el modo desarrollador:** Activa el interruptor en la esquina superior derecha.
5.  **Carga la extensión:** Haz clic en "Cargar descomprimida" y selecciona la carpeta `extension-package` que se encuentra dentro de la carpeta que extrajiste.
6.  **¡Listo!** La extensión aparecerá en tu lista, lista para usar en `notion.so`.

## Créditos y contribuciones

Este proyecto ha sido creado y es mantenido por **[Pablo Felip](https://www.linkedin.com/in/pfelipm/)**.

## Licencia

Este proyecto se distribuye bajo los términos del archivo [LICENSE](/LICENSE).
