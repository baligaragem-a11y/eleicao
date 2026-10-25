# Voto Global — Apuração do 2º turno 2026 ao vivo

Painel estático (React + Vite + Tailwind) que lê os arquivos públicos do TSE direto no navegador:
placar com uma barra por candidato, mapa por estado, tabela de UFs, voto no exterior país por país
e contador de pessoas online somado entre dispositivos.

Não há servidor nem banco de dados: tudo roda no navegador de quem abre a página.

## Publicar no GitHub Pages (grátis)

1. Crie um repositório no GitHub (público ou privado) e envie o projeto:

   ```sh
   git init
   git add .
   git commit -m "Voto Global — painel de apuração"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
   git push -u origin main
   ```

2. No GitHub, abra **Settings → Pages** e, em **Build and deployment → Source**, escolha **GitHub Actions**.

3. Pronto. O workflow em `.github/workflows/deploy-pages.yml` compila e publica sozinho a cada `git push`.
   Acompanhe em **Actions**; o endereço fica em **Settings → Pages**, no formato
   `https://SEU-USUARIO.github.io/SEU-REPOSITORIO/`.

Para republicar depois de uma alteração, basta `git add . && git commit -m "ajuste" && git push`.

### Domínio próprio (opcional)
Em **Settings → Pages → Custom domain**, informe seu domínio e crie no DNS um registro `CNAME`
apontando para `SEU-USUARIO.github.io`. O GitHub emite o HTTPS automaticamente.

## Rodar localmente

```sh
npm install
npm run dev       # http://localhost:5173
npm run build     # gera dist/index.html (arquivo único)
```

## Fontes de dados

- **Totalização oficial**: `resultados.tse.jus.br` — eleição 6258 (2º turno), cargo 0001 (Presidente),
  arquivos EA20 para Brasil, 27 UFs e exterior (ZZ). Atualização a cada 15 s.
- **Boletins de urna do exterior**: publicados pelo TSE por seção; lidos como prévia antes da totalização.
- **Malhas**: IBGE (UFs) e Natural Earth (mundo), embutidas no bundle.

## Contador de pessoas online

Soma visitantes de todos os dispositivos via canal de presença em tempo real num broker MQTT público
(WebSocket, porta 443). Só circulam identificadores aleatórios — nenhum IP ou dado pessoal.
Várias abas do mesmo navegador contam como uma pessoa.

Para um serviço próprio em vez do broker público, publique o Worker em `workers/presence/`
(veja o README da pasta) e preencha a meta `site-presence-endpoint` no `index.html`.

## Avisos

- Projeto independente, sem vínculo com o TSE. Números e percentuais são os publicados pelo TSE.
- O TSE libera CORS para leitura direta pelo navegador; se isso mudar, os dados param de carregar
  e o painel avisa em vez de exibir valores antigos como atuais.
