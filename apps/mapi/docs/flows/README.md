# Flujos por dashboard

Documentación de **flujos operativos** del dashboard de bvcpas. Cada archivo describe **una pantalla/dashboard** desde el punto de vista del frontend: qué endpoints llamar, en qué orden, qué hacer con las respuestas.

## Por qué existe esta carpeta

La documentación OpenAPI (Scalar en `/v1/docs`) está organizada por **tipo de recurso** (`Transactions`, `Followups`, `Public`, etc.). Eso es bueno como referencia técnica pero **mal** para responder "¿qué necesito llamar para construir esta pantalla?".

Esta carpeta es lo opuesto: **un archivo por flujo**, listando los endpoints en el orden que el frontend los usa, con notas operativas y reglas de negocio implícitas que no están en la spec OpenAPI.

## Cómo se llena

Cada vez que diseñamos un dashboard nuevo, antes/durante el desarrollo del backend correspondiente:

1. Se crea `apps/mapi/docs/flows/<nombre-pantalla>.md`.
2. Se documentan los endpoints en orden cronológico de uso.
3. Se incluyen notas operativas: cuándo llamar X vs Y, qué hacer con errores, qué estados son válidos, etc.
4. Cuando el backend cambia (URLs, shapes, errores), el archivo se actualiza junto al commit del backend.

## Índice

- [`customer-support.md`](customer-support.md) — primera tab del dashboard. Snapshot de uncats + AMAs, respuestas del cliente vía link público, status mensual.

(Cuando entren más Mx: reconciliations, w-9, 1099, mgt-report, tax-packet, qtr-payroll, property-tax — cada uno tendrá su archivo.)
