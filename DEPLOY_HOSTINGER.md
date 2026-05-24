---
tenant_id: "face-before-after"
project: "face-before-after"
module: "root/DEPLOY_HOSTINGER"
file_path: "DEPLOY_HOSTINGER.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  ---
tags:
  - "infra"
rag_keywords:
  - "deploy"
  - "hostinger"
related_modules: []
depends_on: []
used_by: []
---
# 🚀 Guia de Deploy - Hostinger/Hostgator + Docker + MinIO

## Pré-requisitos
- ✅ Conta Hostinger/Hostgator criada
- ✅ IP do servidor (será fornecido no painel)
- ✅ Credenciais SSH (usuário + senha ou chave)

---

## PASSO 1: Conectar ao Servidor via SSH

```bash
# Via terminal (Mac/Linux/WSL)
ssh seu_usuario@seu_ip_do_servidor.com

# Você vai ver algo assim:
# The authenticity of host '123.45.67.89' can't be established.
# Type 'yes' e pressione Enter
```

Se você tem uma chave SSH:
```bash
ssh -i ~/.ssh/sua_chave seu_usuario@seu_ip
```

---

## PASSO 2: Instalar Docker

```bash
# Atualizar pacotes
sudo apt-get update && sudo apt-get upgrade -y

# Baixar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Verificar instalação
docker --version
```

---

## PASSO 3: Instalar Docker Compose

```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verificar instalação
docker-compose --version
```

---

## PASSO 4: Clonar seu Repositório

```bash
# Você pode usar HTTPS ou SSH
git clone https://github.com/seu_usuario/face-before-after.git
cd face-before-after

# Ou se usar SSH (se tiver configurado chave no GitHub):
git clone git@github.com:seu_usuario/face-before-after.git
cd face-before-after
```

Se não tiver Git instalado:
```bash
sudo apt-get install -y git
```

---

## PASSO 5: Configurar Variáveis de Ambiente

```bash
# Copiar arquivo de exemplo
cp .env.example .env

# Editar credenciais (use nano ou vim)
nano .env

# Altere as linhas:
# MINIO_ROOT_PASSWORD=COLOQUE_UMA_SENHA_FORTE_AQUI
# MINIO_SECRET_KEY=COLOQUE_UMA_SENHA_FORTE_AQUI
# VITE_API_URL=http://seu_ip_do_servidor:9015
```

Depois de editar, pressione `Ctrl+O`, `Enter`, `Ctrl+X` para sair do nano.

---

## PASSO 6: Build e Deploy

```bash
# Buildear as imagens Docker
docker-compose -f docker-compose.prod.yml build

# Subir os serviços
docker-compose -f docker-compose.prod.yml up -d

# Verificar status
docker-compose -f docker-compose.prod.yml ps

# Ver logs (útil se algo deu errado)
docker-compose -f docker-compose.prod.yml logs -f
```

Se ver `State: Up` em todos os containers, está rodando! 🎉

### ⚠️ Se receber erro "413 Request Entity Too Large"
Isso foi corrigido automaticamente no `nginx.conf`. Não faz nada, está tudo OK!
- Limite de upload: **100MB**
- Timeout de requisição: **300 segundos**

---

## PASSO 7: Acessar a Aplicação

**Frontend (React):**
```
http://seu_ip_do_servidor:9016
```

**API (FastAPI):**
```
http://seu_ip_do_servidor:9015
http://seu_ip_do_servidor:9015/docs  (documentação automática)
```

**MinIO Console (admin):**
```
http://seu_ip_do_servidor:9018
```

Login:
- Usuário: `minioadmin` (ou o que você colocou em `MINIO_ROOT_USER`)
- Senha: Aquela que você colocou em `MINIO_ROOT_PASSWORD`

---

## PASSO 8: Comandos Úteis

```bash
# Ver logs em tempo real
docker-compose -f docker-compose.prod.yml logs -f

# Parar tudo
docker-compose -f docker-compose.prod.yml down

# Reiniciar tudo
docker-compose -f docker-compose.prod.yml restart

# Deletar tudo e começar do zero
docker-compose -f docker-compose.prod.yml down -v

# Atualizar código (se fez push no GitHub)
git pull
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

---

## OPCIONAL: Usar Domínio ao invés de IP

Se comprar um domínio (p.ex, `meuface.com`):

1. **No painel do seu registrador DNS** (Hostinger, GoDaddy, etc):
   - Apontar `meuface.com` para `seu_ip_do_servidor`

2. **No seu servidor**, instalar Let's Encrypt (HTTPS grátis):
```bash
sudo apt-get install -y certbot
sudo certbot certonly --standalone -d meuface.com
```

3. **Configurar Nginx como reverse proxy** (mais avançado, posso ajudar depois)

---

## Troubleshooting

### ❌ "docker: command not found"
```bash
sudo usermod -aG docker $USER
newgrp docker
```

### ❌ "MinIO health check failed"
Espere 60 segundos e tente novamente. MinIO leva tempo para iniciar.

### ❌ "Cannot connect to Docker daemon"
```bash
sudo systemctl start docker
sudo systemctl enable docker
```

### ❌ "Port 9015/9016/9017 already in use"
```bash
# Mude as portas no docker-compose.prod.yml
# Por exemplo, mude "9015:8000" para "8015:8000"
```

---

## ✅ Checklist Final

- [ ] SSH conectado ao servidor
- [ ] Docker instalado
- [ ] Docker Compose instalado
- [ ] Repositório clonado
- [ ] `.env` criado com senhas fortes
- [ ] `docker-compose up -d` rodando
- [ ] Frontend acessível em `http://seu_ip:9016`
- [ ] API acessível em `http://seu_ip:9015`
- [ ] MinIO acessível em `http://seu_ip:9018`

**Pronto para usar! 🚀**
