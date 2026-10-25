# Contador real de visitantes simultâneos

O contador usa Cloudflare Durable Objects para acompanhar sessões ativas. Cada navegador recebe um UUID aleatório; o Worker guarda somente esse UUID e o horário do último heartbeat por até 75 segundos.

- Não usa IP como identificador e o código do Worker não lê nem armazena IP.
- Abas do mesmo navegador compartilham um UUID e contam como uma sessão.
- Navegadores/dispositivos diferentes contam como sessões diferentes; isso não equivale necessariamente a pessoas físicas.
- **Sem endpoint configurado, o site já soma pessoas entre dispositivos** por um canal de presença em tempo real num broker MQTT público (`public.cloud.shiftr.io`, com reservas `broker.emqx.io` e `broker.hivemq.com`). Cada aba publica uma mensagem retida num tópico exclusivo e registra um "testamento" que a apaga quando a conexão cai; quem entra recebe o total atual na hora. Só circulam IDs aleatórios.
- Este Worker é a opção **própria e privada** (sem depender de broker de terceiros): quando a meta `site-presence-endpoint` está preenchida, ele tem prioridade; se ficar fora do ar, o site volta sozinho para o canal público.
- Se nem o endpoint nem o canal público responderem (rede bloqueando WebSocket), o site mostra só as abas do próprio navegador e avisa “contador global indisponível”.

## Publicar

1. Instale/autentique o Wrangler: `npx wrangler login`.
2. Edite `wrangler.toml` e substitua `SEU-DOMINIO.com` pelo domínio real do painel.
3. Na raiz do projeto, publique: `npx wrangler deploy --config workers/presence/wrangler.toml`.
4. Copie a URL `workers.dev` gerada e configure em `index.html`:

   ```html
   <meta name="site-presence-endpoint" content="https://voto-global-presence.SEU-USUARIO.workers.dev/api/presence" />
   ```

5. Publique o site novamente. O painel envia um heartbeat a cada 15 segundos e conta sessões ativas nos últimos 75 segundos.

## API

- `POST /api/presence/heartbeat` com `{"visitorId":"UUID-anonimo"}` registra/renova uma sessão.
- `GET /api/presence` retorna `{"online":123,"windowSeconds":75}`.
- A origem do site precisa estar em `ALLOWED_ORIGINS` para que o navegador aceite a resposta CORS.