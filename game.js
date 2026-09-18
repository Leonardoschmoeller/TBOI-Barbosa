/* 
  Cyber Requiem - Roguelike 2D Completo v6.0 - HUD TOPO + Q TROCA + TIRO DUPLO + METRALHADORA + CARREGADA + Bone Heart
  Arquitetura: Game, Player, Chaser, Fugitive, Kamikaze, Summoner, Bullet, Room, MapGenerator, Particle, InputHandler, Item/HealingItem/WeaponItem/FlameTrailItem/SwiftBootsItem/DoubleShotItem, FirePatch, Spike
  Controles: WASD mover, Setas atirar 8 direções (segurar = carregar CARREGADA), Shift dash, Q troca com arma no chão próxima (58px, hint, sem duplicação)
  Novidades v5.1: Arma comum CARREGADA com mecânica de carregamento (segurar seta carrega dano 1→4, barra roxa, cancela ao trocar) + Q troca robusta (reutiliza objeto, sem duplicação/desaparecimento/infinito, hint)
  Novidades v5: HUD topo compacto, Q troca com arma no chão (sem duplicação), Tiro Duplo lado a lado (WEAPON_NORMAL melhorada), Metralhadora rara com aquecimento (TEMP bar) e redução velocidade
  Novidades v4: Fase 3 Abismo, Kamikaze, Summoner, Espinhos, Sala Rara
  Novidades v3: Sistema Q toggle, Rastro de Fogo, Raio, Botas
  Como executar:
    - Live Server VS Code: clique direito em index.html > Open with Live Server
    - Local: apenas abra index.html no navegador (file:// funciona, caminhos relativos)
    - GitHub Pages: push para repo > Settings > Pages > Deploy from branch (main / root)
  Compatível com hospedagem estática, sem backend.
*/

// ===================== CONSTANTES =====================
const CANVAS_W = 960;
const CANVAS_H = 540;
const WALL_THICK = 22;
const DOOR_W = 90;
const DOOR_H = 70;
const PLAYER_SIZE = 24;
const PLAYER_SPEED = 3.0;
const JL_SPEED_FACTOR = 0.89;       // JL ~11% mais lento que base (um pouco mais lento conforme pedido)
const KINIGHT_SPEED_FACTOR = 0.86;  // Kinight ~14% mais lento (tanque, armadura pesada)
const DASH_SPEED = 8.5;
const DASH_DURATION = 160; // ms
const DASH_COOLDOWN = 900;
const DASH_INVULN = 220;

// --- Sistema de Armas configurável (balanceamento) ---
// Reduzido cadência: antes 165ms, agora 280ms normal (menos spam), Shotgun 420ms mas 5 projéteis
const WEAPON_NORMAL = {
  name: 'NORMAL',
  cooldown: 280,      // variável configurável - intervalo maior = menos tiros
  range: 380,         // alcance longo
  damage: 1,          // dano baixo por tiro
  count: 1,           // 1 projétil
  spread: 0,          // sem cone
  bulletSpeed: 7.2,
  color: '#ffeb3b',
  bulletSize: 6,
  pierce: false
};
const WEAPON_SHOTGUN = {
  name: 'SHOTGUN',
  cooldown: 420,      // cadência menor que normal (balance)
  range: 240,         // alcance reduzido
  damage: 1,          // dano por pellet (total 5 = 5 dano se todos acertarem)
  count: 5,           // 5 projéteis em cone
  spread: 0.38,       // abertura do cone em radianos (~22 graus total)
  bulletSpeed: 7.0,
  color: '#ff8c42',
  bulletSize: 5,
  pierce: false
};
// Nova arma extremamente rara: RAIO - feixe elétrico perfurante, dano alto, alcance longo
const WEAPON_RAIO = {
  name: 'RAIO',
  cooldown: 520,      // cadência menor (equilíbrio: poderoso mas lento)
  range: 500,         // alcance longo
  damage: 3,          // dano alto por disparo
  count: 1,
  spread: 0,
  bulletSpeed: 11.5,  // projétil muito rápido (quase instantâneo)
  color: '#00e5ff',
  bulletSize: 5,
  pierce: true,       // atravessa inimigos (não paredes)
  trailColor: 'rgba(0,229,255,0.35)',
  glow: 'rgba(0,229,255,0.32)'
};
// Nova arma rara: METRALHADORA - alta cadência, aquecimento, redução de velocidade
const WEAPON_METRALHADORA = {
  name: 'METRALHADORA',
  cooldown: 68,       // alta cadência (variável fácil de editar)
  range: 360,
  damage: 0.85,       // dano por bala menor para balancear cadência alta
  count: 1,
  spread: 0.13,       // leve dispersão
  bulletSpeed: 9.2,
  color: '#ff3b30',
  bulletSize: 4,
  pierce: false,
  isMinigun: true
};
// Variáveis configuráveis metralhadora (fácil edição)
const METRALHADORA_HEAT_MAX = 100;        // temperatura máxima
const METRALHADORA_HEAT_PER_SHOT = 6.2;   // aquecimento por tiro
const METRALHADORA_COOL_RATE = 32;        // resfriamento por segundo quando não atira
const METRALHADORA_COOL_RATE_OVERHEAT = 42; // resfriamento durante superaquecimento
const METRALHADORA_OVERHEAT_TIME = 1650;  // ms bloqueada quando superaquece
const METRALHADORA_SPEED_PENALTY = 0.95;  // redução de velocidade quando equipada

// Nova arma comum: CARREGADA - mecânica de carregamento de dano (segurar para carregar)
// Integrada ao sistema de armas existente, variáveis fáceis de modificar abaixo
const WEAPON_CARREGADA = {
  name: 'CARREGADA',
  cooldown: 420,      // intervalo após disparo (variável configurável)
  range: 420,         // alcance levemente maior que NORMAL
  damage: 1,          // placeholder - dano real vem de CHARGED_* interpolado
  count: 1,
  spread: 0,
  bulletSpeed: 8.5,
  color: '#a78bfa',   // roxo para distinguir
  bulletSize: 6,
  pierce: false,
  isCharged: true     // flag identifica mecânica de carga
};
// Variáveis configuráveis arma carregada (fácil edição) - organizadas conforme requisito
const CHARGED_MIN_DAMAGE = 1;          // dano mínimo (clique rápido / carga mínima)
const CHARGED_MAX_DAMAGE = 4;          // dano máximo (carga completa, 2 corações)
const CHARGED_MIN_CHARGE_TIME = 140;   // ms mínimo para começar a escalar dano
const CHARGED_MAX_CHARGE_TIME = 1100;  // ms até carga máxima (segurar ~1.1s = dano máx)

// Melhoria arma principal: tiro duplo lado a lado
const DOUBLE_SHOT_OFFSET = 7; // deslocamento lateral em pixels (variável fácil de editar)

// Troca de armas por proximidade
const WEAPON_SWAP_RANGE = 58; // alcance para troca com Q (variável fácil de editar)
// Troca de itens especiais por proximidade (E)
const SPECIAL_SWAP_RANGE = 58; // alcance para pegar/trocar especial com E (configurável)
// --- Configurações Flecha Stand (incomum, aleatória) - todas editáveis ---
const FLECHA_COOLDOWN = 10000; // 10s cooldown (configurável por item)
const FLECHA_SLOW_RADIUS = 170; // área lentidão
const FLECHA_SLOW_DURATION = 4000; // duração lentidão
const FLECHA_SLOW_FACTOR = 0.45; // velocidade reduzida para 45% (0.5 = 50%)
const FLECHA_STUN_RADIUS = 170; // área paralisia
const FLECHA_STUN_DURATION = 5000; // 5s fixo conforme requisito
const FLECHA_ALLY_DURATION = 8000; // aliado fica 8s
const FLECHA_ALLY_DETECT_RADIUS = 220; // detecta inimigo
const FLECHA_ALLY_SPEED = 2.8;
const FLECHA_ALLY_DAMAGE = 2; // 1 coração
const FLECHA_ALLY_ATTACK_COOLDOWN = 700;
// Chances configuráveis (devem somar 1.0). Fácil alterar para balancear.
const FLECHA_CHANCES = {
  lentidao: 0.3333, // 33,33% Lentidão em Massa
  aliado:   0.3333, // 33,33% Invocar Aliado
  paralisia:0.3334  // 33,33% Paralisia em Massa
};
// --- Configurações Gato Antivírus (incomum) - todas editáveis ---
const GATO_ANTIVIRUS_COOLDOWN = 4500; // cooldown do E (chamar de volta) - 4.5s (variável balanceável)
const GATO_ANTIVIRUS_DETECT_RADIUS = 220; // raio de detecção de inimigos (configurável)
const GATO_ANTIVIRUS_SPEED = 3.15; // velocidade de deslocamento (configurável)
const GATO_ANTIVIRUS_DAMAGE = 2.2; // dano ao atacar (1.1 corações, configurável)
const GATO_ANTIVIRUS_STUN_DURATION = 1800; // ms atordoado após ataque (1.8s, configurável)
const GATO_ANTIVIRUS_RETURN_COOLDOWN = 2000; // 2 segundos parado perto do jogador após voltar (requisito fixo, configurável)
const GATO_ANTIVIRUS_ATTACK_RANGE = 22; // distância para encostar e atacar (configurável)

// ===================== SISTEMA DE ITENS ESPECIAIS (E + COOLDOWN) =====================
// Arquitetura modular: toda lógica fica aqui, separada do Player/Game.
// - Classe base SpecialItem controla cooldown de forma confiável com UM único timer (dt), sem setInterval/setTimeout múltiplos.
// - Subclasses definem apenas a habilidade específica.
// - Player apenas armazena equippedSpecial; Game apenas chama tryActivate/update.
// Para adicionar novo item: crie classe estendendo SpecialItem e registre em SPECIAL_REGISTRY. Não precisa reescrever Game/Player.
// ------------------------------------------------------------------
// Classe base: controla cooldown, duração, bloqueio de spam e interface.
// NÃO cria timers desnecessários: tudo por this.cooldownRemaining -= dt no update(dt) único do Game loop.
class SpecialItem {
  constructor(config){
    // config = { id, name, key='e', cooldown=10000, duration=0, icon='★', description, color }
    this.id = config.id; // identificador único para fábrica
    this.name = config.name; // ex: 'ESPADA FLAMEJANTE'
    this.key = (config.key||'e').toLowerCase(); // tecla de ativação, padrão E
    this.cooldown = config.cooldown ?? 10000; // ms de recarga (variável balanceável)
    this.duration = config.duration ?? 0; // ms de efeito ativo (0 = instantâneo)
    this.icon = config.icon ?? '★'; // ícone HUD
    this.description = config.description ?? '';
    this.color = config.color ?? '#ffcc00'; // cor tema para HUD/partículas
    // Estado interno - controlado apenas por update(dt)
    this.cooldownRemaining = 0; // ms restantes; 0 = pronto
    this.durationRemaining = 0; // ms restantes de efeito ativo
    this.isActive = false; // true enquanto duration >0
  }
  // Retorna true se pode ativar agora (sem cooldown e sem efeito ativo conflitante)
  canActivate(){
    return this.cooldownRemaining <= 0 && !this.isActive;
  }
  isOnCooldown(){
    return this.cooldownRemaining > 0;
  }
  // Percentual 0..1 para barra/círculo: 0 = pronto, 1 = cooldown cheio
  getCooldownPercent(){
    if(this.cooldownRemaining <= 0) return 0;
    return clamp(this.cooldownRemaining / this.cooldown, 0, 1);
  }
  // Segundos inteiros restantes para texto "Cooldown: 14s"
  getRemainingSeconds(){
    return Math.ceil(this.cooldownRemaining / 1000);
  }
  // Percentual de duração ativa (para barra quando tem duration)
  getDurationPercent(){
    if(!this.isActive || this.duration<=0) return 0;
    return clamp(this.durationRemaining / this.duration, 0, 1);
  }
  // Tenta ativar: verifica canActivate, executa habilidade, inicia cooldown.
  // Retorna true se ativou, false se bloqueado (cooldown ativo ou spam).
  // Spam-safe: múltiplos E rápidos só o primeiro passa, pois cooldownRemaining já >0.
  tryActivate(player, game){
    if(!this.canActivate()) return false;
    // Chama habilidade concreta
    this.activate(player, game);
    // Inicia cooldown de forma confiável (sem timer extra, apenas valor numérico)
    this.cooldownRemaining = this.cooldown;
    if(this.duration > 0){
      this.isActive = true;
      this.durationRemaining = this.duration;
      this.onActivated(player, game); // hook visual/sonoro
    } else {
      this.playEffects(player, game);
    }
    return true;
  }
  // Método a ser sobrescrito por cada item especial: lógica da habilidade
  activate(player, game){
    // override obrigatório
    console.warn(`SpecialItem ${this.id} sem activate() implementado`);
  }
  // Hooks opcionais para efeitos visuais/sonoros
  playEffects(player, game){}
  onActivated(player, game){}
  onActiveTick(dt, player, game){} // chamado todo frame enquanto isActive
  onDeactivate(player, game){}
  // Update único por frame - evita múltiplos timers. Chamado 1x em Game.update(dt).
  update(dt, player, game){
    // Cooldown decrementa sempre que >0, com dt do loop principal (confiável mesmo com lag)
    if(this.cooldownRemaining > 0){
      this.cooldownRemaining = Math.max(0, this.cooldownRemaining - dt);
    }
    // Duração ativa
    if(this.isActive){
      this.durationRemaining -= dt;
      this.onActiveTick(dt, player, game);
      if(this.durationRemaining <= 0){
        this.isActive = false;
        this.durationRemaining = 0;
        this.onDeactivate(player, game);
      }
    }
  }
  // Texto para HUD: "Pronto!" ou "Cooldown: Xs" ou "Ativo: Xs"
  getStatusText(){
    if(this.isActive) return `Ativo: ${Math.ceil(this.durationRemaining/1000)}s`;
    if(this.isOnCooldown()) return `Cooldown: ${this.getRemainingSeconds()}s`;
    return 'Pronto!';
  }
}

// Item 1: Espada Flamejante - explosão de fogo ao redor do jogador
// Tecla: E | Cooldown: 10s | Instantâneo | Dano em área + partículas + camera shake
class EspadaFlamejante extends SpecialItem {
  constructor(){
    super({
      id: 'espada_flamejante',
      name: 'ESPADA FLAMEJANTE',
      key: 'e',
      cooldown: 10000, // 10 segundos (variável fácil de ajustar)
      duration: 0, // instantâneo
      icon: '🔥',
      description: 'Cria explosão de fogo ao redor do jogador',
      color: '#ff6a00'
    });
    this.radius = 120; // raio da explosão (variável configurável)
    this.damage = 3;   // dano da explosão (variável)
    this.burnTicks = 0; // opcional: fogo residual
  }
  activate(player, game){
    const cx = player.x, cy = player.y;
    const room = game.currentRoom;
    if(!room) return;
    // Círculo visual de explosão (reutiliza sistema de explosões do Kamikaze)
    room.explosions.push({ x: cx, y: cy, radius: 14, life: 360, max: 360, isFlameSword: true });
    // Dano em área nos inimigos
    let hitCount = 0;
    for(const e of room.enemies){
      if(e.dead) continue;
      const d = dist(cx, cy, e.x, e.y);
      if(d < this.radius){
        const died = e.takeDamage(this.damage);
        hitCount++;
        // Knockback para fora
        const ang = Math.atan2(e.y - cy, e.x - cx) || 0;
        e.x += Math.cos(ang)*12;
        e.y += Math.sin(ang)*12;
        // Partículas de fogo no inimigo
        for(let k=0;k<6;k++) game.particles.push(new Particle(e.x, e.y, randRange(-2.5,2.5), randRange(-2.5,0.5), 320, '#ff6a00', 3));
        if(died){
          for(let k=0;k<14;k++){ const ang2=Math.random()*Math.PI*2; game.particles.push(new Particle(e.x,e.y, Math.cos(ang2)*randRange(1.5,5), Math.sin(ang2)*randRange(1.5,5), 400, randInt(0,1)?'#ff3b00':'#ffcc00', randInt(3,5))); }
        }
      } else if(d < this.radius + 18){
        // Borda: meio dano
        e.takeDamage(1);
        for(let k=0;k<3;k++) game.particles.push(new Particle(e.x, e.y, randRange(-1.5,1.5), randRange(-1.2,0.5), 220, '#ff8c00', 2));
      }
    }
    // Fogo residual no chão (3 patches ao redor) - efeito visual estratégico
    for(let i=0;i<3;i++){
      const ang = Math.random()*Math.PI*2, r = randRange(18, 46);
      const fx = cx + Math.cos(ang)*r, fy = cy + Math.sin(ang)*r;
      let onWall=false;
      for(const w of room.walls) if(rectCollide(fx-fireRadius, fy-fireRadius, fireRadius*2, fireRadius*2, w.x, w.y, w.w, w.h)){ onWall=true; break; }
      if(!onWall) room.fires.push(new FirePatch(fx, fy));
    }
    // Efeitos globais: partículas, shake, flash
    for(let k=0;k<28;k++){ const ang=Math.random()*Math.PI*2, sp=randRange(2.2,6.5); const col=['#ff3b00','#ff6a00','#ffcc00','#ffffff'][randInt(0,3)]; game.particles.push(new Particle(cx, cy, Math.cos(ang)*sp, Math.sin(ang)*sp, randRange(300,520), col, randInt(3,6))); }
    for(let k=0;k<10;k++) game.particles.push(new Particle(cx+randRange(-12,12), cy+randRange(-12,12), randRange(-1,1), randRange(-2,-0.4), 400, 'rgba(255,140,0,0.9)', 2));
    game.shake = Math.max(game.shake, 120);
    // Som placeholder (WebAudio simples: beep) - pode substituir por Audio('explosion.ogg').play()
    this.playEffects(player, game);
  }
  playEffects(player, game){
    // Feedback opcional: poderia tocar som aqui
    // Ex: new Audio('assets/fire_explosion.ogg').play().catch(()=>{});
    // Por enquanto, apenas log para debug
    // console.log('[SFX] Espada Flamejante! Boom');
  }
}

// Item 2: Escudo Mágico - absorve um dano
// Tecla: E | Cooldown: 15s | Duração: 5s (ou até absorver) | Absorve 1 hit completo, visual aura + partículas
class EscudoMagico extends SpecialItem {
  constructor(){
    super({
      id: 'escudo_magico',
      name: 'ESCUDO MÁGICO',
      key: 'e',
      cooldown: 15000, // 15 segundos
      duration: 5000,  // 5 segundos ativo ou até absorver
      icon: '🛡️',
      description: 'Absorve um dano e ao quebrar empurra inimigos ao redor',
      color: '#00e5ff'
    });
    this.tickGlow = 0;
  }
  activate(player, game){
    // Ativa escudo com 1 carga - absorve um dano completo
    player.shieldActive = true;
    player.shieldCharges = 1; // uma absorção
    player.shieldReduction = 1; // compatibilidade (100% se fosse redução)
    // Partículas iniciais de ativação
    for(let k=0;k<18;k++){ const ang=Math.random()*Math.PI*2; game.particles.push(new Particle(player.x, player.y, Math.cos(ang)*randRange(1.2,3.8), Math.sin(ang)*randRange(1.2,3.8), 420, '#00e5ff', 3)); }
    for(let k=0;k<8;k++) game.particles.push(new Particle(player.x, player.y, randRange(-1.5,1.5), randRange(-1.5,0.6), 500, '#ffffff', 2));
    game.shake = Math.max(game.shake, 60);
    if(game.showToast) game.showToast('🛡️ Escudo ativo — absorve o próximo dano!', 1600);
  }
  onActiveTick(dt, player, game){
    this.tickGlow += dt;
    // Se escudo já absorveu (carga 0), encerra duração antecipadamente e vai para cooldown
    if(player.shieldCharges !== undefined && player.shieldCharges <= 0){
      // força fim do efeito antes dos 5s
      this.durationRemaining = 0;
      return;
    }
    // Aura pulsante + partículas sutis enquanto ativo
    if(Math.random() < 0.28){
      const ang = Math.random()*Math.PI*2, r = 18 + Math.sin(this.tickGlow*0.006)*3;
      const px = player.x + Math.cos(ang)*r;
      const py = player.y + Math.sin(ang)*r;
      game.particles.push(new Particle(px, py, randRange(-0.4,0.4), randRange(-0.8,-0.2), 260, 'rgba(0,229,255,0.85)', 2));
    }
    // Brilho extra a cada 0.6s
    if(Math.floor(this.tickGlow/600) !== Math.floor((this.tickGlow-dt)/600)){
      game.particles.push(new Particle(player.x, player.y, randRange(-0.6,0.6), -0.8, 200, '#ffffff', 1));
    }
  }
  onDeactivate(player, game){
    player.shieldActive = false;
    player.shieldCharges = 0;
    player.shieldReduction = 0;
    // Efeito de quebra/desativação do escudo
    for(let k=0;k<14;k++){ const ang=Math.random()*Math.PI*2; game.particles.push(new Particle(player.x, player.y, Math.cos(ang)*randRange(1.8,4.2), Math.sin(ang)*randRange(1.2,3), 360, '#7af', 2)); }
    game.shake = Math.max(game.shake, 70);
  }
  // Chamado quando escudo absorve um dano — bloqueia, empurra inimigos e entra em destruição
  onAbsorb(player, game){
    // Resolve referência de jogo (pode vir via opts.game ou window.game)
    const g = (game && game.currentRoom) ? game : (typeof window !== 'undefined' && window.game ? window.game : game);
    const room = g && g.currentRoom ? g.currentRoom : (game && game.currentRoom ? game.currentRoom : null);
    const particles = g && g.particles ? g.particles : (game && game.particles ? game.particles : []);
    for(let k=0;k<16;k++){ const ang=Math.random()*Math.PI*2; particles.push(new Particle(player.x, player.y, Math.cos(ang)*randRange(1.4,3.6), Math.sin(ang)*randRange(1.2,3), 340, '#00e5ff', 2)); }
    for(let k=0;k<8;k++) particles.push(new Particle(player.x, player.y, randRange(-1,1), randRange(-1,0.6), 260, '#ffffff', 2.5));
    // Anel de bloqueio + onda de repulsão
    if(room){
      room.explosions.push({x:player.x, y:player.y, radius:10, life:280, max:280, isShieldBlock:true});
      // Onda de empurrão maior
      room.explosions.push({x:player.x, y:player.y, radius:14, life:380, max:380, isShieldPush:true});
    }
    if(g) g.shake = Math.max(g.shake||0, 110);
    if(g && g.showToast) g.showToast('🛡️ Escudo quebrou — inimigos repelidos!', 1600);
    // Empurra todos os inimigos próximos
    if(room && room.enemies){
      const pushRadius = 145; // raio de repulsão (configurável)
      const baseForce = 22;
      for(const e of (room.enemies || [])){
        if(e.dead) continue;
        // Boss: empurra mãos e cabeça? Para stair_boss, empurra mãos individualmente
        if(e.type === 'stair_boss' && e.getHands){
          // Empurra cabeça
          const dHead = dist(player.x, player.y, e.x, e.y);
          if(dHead < pushRadius + 20){
            const ang = Math.atan2(e.y - player.y, e.x - player.x) || (Math.random()*Math.PI*2);
            const falloff = 1 - Math.min(dHead / pushRadius, 1);
            const force = baseForce * (0.6 + falloff*0.8);
            e.x += Math.cos(ang)*force*0.55;
            e.y += Math.sin(ang)*force*0.45;
            e.hitFlash = 180;
            e.x = clamp(e.x, WALL_THICK + e.w/2, CANVAS_W - WALL_THICK - e.w/2);
            e.y = clamp(e.y, WALL_THICK + e.h/2, CANVAS_H - WALL_THICK - e.h/2);
          }
          // Empurra mãos
          for(const hand of e.getHands()){
            if(hand.dead) continue;
            const d = dist(player.x, player.y, hand.x, hand.y);
            if(d < pushRadius){
              const ang = Math.atan2(hand.y - player.y, hand.x - player.x) || (Math.random()*Math.PI*2);
              const falloff = 1 - (d / pushRadius);
              const force = baseForce * (0.7 + falloff*0.6);
              hand.x += Math.cos(ang)*force;
              hand.y += Math.sin(ang)*force*0.7;
              hand.hitFlash = 160;
              hand.x = clamp(hand.x, WALL_THICK + hand.w/2, CANVAS_W - WALL_THICK - hand.w/2);
              hand.y = clamp(hand.y, WALL_THICK + hand.h/2, CANVAS_H - WALL_THICK - hand.h/2);
              for(let k=0;k<3;k++) particles.push(new Particle(hand.x, hand.y, Math.cos(ang)*randRange(0.6,1.8), Math.sin(ang)*randRange(0.6,1.8), 260, '#7af', 2));
            }
          }
          continue;
        }
        const d = dist(player.x, player.y, e.x, e.y);
        if(d < pushRadius){
          const ang = Math.atan2(e.y - player.y, e.x - player.x) || (Math.random()*Math.PI*2);
          const falloff = 1 - (d / pushRadius);
          const force = baseForce * (0.6 + falloff*0.9);
          e.x += Math.cos(ang)*force;
          e.y += Math.sin(ang)*force;
          e.hitFlash = Math.max(e.hitFlash||0, 160);
          // Pequeno stun para inimigos de investida / chaser
          if(e.stunTimer !== undefined && e.type !== 'miniboss' && e.type !== 'stair_boss'){
            e.stunTimer = Math.max(e.stunTimer||0, 180);
          }
          // Evita atravessar parede
          let onWall=false;
          if(room.walls){
            for(const w of room.walls) if(rectCollide(e.x - e.w/2, e.y - e.h/2, e.w, e.h, w.x,w.y,w.w,w.h)){ onWall=true; break; }
            if(onWall){
              e.x -= Math.cos(ang)*force*0.5;
              e.y -= Math.sin(ang)*force*0.5;
            }
          }
          e.x = clamp(e.x, WALL_THICK + e.w/2, CANVAS_W - WALL_THICK - e.w/2);
          e.y = clamp(e.y, WALL_THICK + e.h/2, CANVAS_H - WALL_THICK - e.h/2);
          for(let k=0;k<4;k++) particles.push(new Particle(e.x, e.y, Math.cos(ang)*randRange(0.6,1.6), Math.sin(ang)*randRange(0.6,1.6), 240, '#00e5ff', 2));
          for(let k=0;k<2;k++) particles.push(new Particle(e.x, e.y, randRange(-0.8,0.8), randRange(-0.8,0.4), 220, '#ffffff', 1.5));
        }
      }
    }
    // Consome carga e força desativação
    player.shieldCharges = 0;
    player.shieldActive = false;
    // força o SpecialItem a encerrar e entrar em cooldown visual
    this.durationRemaining = 0;
    this.isActive = false;
    this.onDeactivate(player, g || game);
  }
  playEffects(player, game){} // já fez em activate
}

// ===================== ALIADO STAND (para Flecha Stand - Invocar Aliado) =====================
// Aliado temporário que persegue e ataca inimigos
class StandAlly {
  constructor(x, y){
    this.x = x; this.y = y;
    this.w = 26; this.h = 26;
    this.speed = FLECHA_ALLY_SPEED; // configurável
    this.duration = FLECHA_ALLY_DURATION;
    this.life = FLECHA_ALLY_DURATION; // ms restantes
    this.dead = false;
    this.anim = Math.random()*1000;
    this.target = null;
    this.attackCooldown = 0;
    this.hitFlash = 0;
  }
  // Atualiza movimento, busca e ataque. Retorna false se expirou.
  update(dt, enemies, walls, particles){
    this.life -= dt;
    this.anim += dt;
    if(this.hitFlash>0) this.hitFlash-=dt;
    if(this.attackCooldown>0) this.attackCooldown-=dt;
    if(this.life <= 0){ this.dead=true; return false; }
    // Busca alvo mais próximo dentro do raio de detecção
    if(!this.target || this.target.dead || dist(this.x,this.y,this.target.x,this.target.y) > FLECHA_ALLY_DETECT_RADIUS*1.5){
      let best=null, bestD=FLECHA_ALLY_DETECT_RADIUS;
      for(const e of enemies){
        if(e.dead) continue;
        // ignora se está em outra sala? enemies é da sala atual
        const d=dist(this.x,this.y,e.x,e.y);
        if(d < bestD){ best=e; bestD=d; }
      }
      this.target = best;
    }
    if(this.target && !this.target.dead){
      const dx=this.target.x - this.x, dy=this.target.y - this.y;
      const d=Math.hypot(dx,dy)||1;
      if(d < 22){
        // Ataca quando encosta
        if(this.attackCooldown<=0){
          const died=this.target.takeDamage(FLECHA_ALLY_DAMAGE);
          this.attackCooldown=FLECHA_ALLY_ATTACK_COOLDOWN;
          this.hitFlash=120;
          // knockback leve
          this.target.x += (dx/d)*7;
          this.target.y += (dy/d)*7;
          // partículas de impacto
          if(particles){
            for(let k=0;k<6;k++) particles.push(new Particle(this.target.x,this.target.y, randRange(-1.8,1.8), randRange(-1.8,0.5), 220, '#c084fc', 2));
            if(died) for(let k=0;k<10;k++){ const ang=Math.random()*Math.PI*2; particles.push(new Particle(this.target.x,this.target.y, Math.cos(ang)*randRange(1.2,3.2), Math.sin(ang)*randRange(1.2,3.2), 300, '#a78bfa', 2)); }
          }
          // após matar, já procurará novo alvo no próximo frame
        }
      } else {
        // Move em direção ao alvo com desvio de paredes simples
        const n=normalize(dx,dy);
        let nx=this.x + n.x*this.speed;
        let ny=this.y + n.y*this.speed;
        let canX=true, canY=true;
        const hw=this.w/2, hh=this.h/2;
        for(const w of walls){
          if(rectCollide(nx-hw, this.y-hh, this.w, this.h, w.x,w.y,w.w,w.h)) canX=false;
          if(rectCollide(this.x-hw, ny-hh, this.w, this.h, w.x,w.y,w.w,w.h)) canY=false;
        }
        if(canX) this.x=nx;
        if(canY) this.y=ny;
        this.x=clamp(this.x, WALL_THICK+this.w/2, CANVAS_W-WALL_THICK-this.w/2);
        this.y=clamp(this.y, WALL_THICK+this.h/2, CANVAS_H-WALL_THICK-this.h/2);
      }
    } else {
      // Sem alvo: fica orbitando levemente (patrulha)
      this.x += Math.sin(this.anim*0.0025)*0.45;
      this.y += Math.cos(this.anim*0.0022)*0.45;
    }
    return !this.dead;
  }
  draw(ctx){
    const x=this.x - this.w/2, y=this.y - this.h/2, bob=Math.sin(this.anim*0.010)*1.6;
    const isFlash=this.hitFlash>0 && Math.floor(this.hitFlash/40)%2===0;
    ctx.fillStyle='rgba(0,0,0,0.30)'; ctx.fillRect(x+2, y+this.h-3, this.w, 3);
    // aura Stand
    const pulse=0.5+Math.sin(this.anim*0.008)*0.35;
    ctx.fillStyle=`rgba(192,132,252,${0.14+pulse*0.08})`;
    ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.85+pulse*4, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle=`rgba(192,132,252,${0.35+pulse*0.15})`; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.82, 0, Math.PI*2); ctx.stroke();
    // corpo Stand (roxo/branco JoJo)
    ctx.fillStyle=isFlash?'#fff':'#7c3aed';
    ctx.fillRect(x+4, y+6+bob, this.w-8, this.h-10);
    ctx.fillStyle=isFlash?'#e9d5ff':'#4c1d95';
    ctx.fillRect(x+2, y+8+bob, 2, this.h-12);
    ctx.fillRect(x+this.w-4, y+8+bob, 2, this.h-12);
    // cabeça / capacete
    ctx.fillStyle=isFlash?'#fff':'#ddd6fe';
    ctx.fillRect(x+6, y+2+bob, this.w-12, 8);
    // olhos Stand
    ctx.fillStyle='#00ff88';
    ctx.fillRect(x+7, y+4+bob, 4,3);
    ctx.fillRect(x+15, y+4+bob, 4,3);
    ctx.fillStyle='#fff';
    ctx.fillRect(x+8, y+5+bob,1,1); ctx.fillRect(x+16,y+5+bob,1,1);
    // braços em pose
    ctx.fillStyle=isFlash?'#fff':'#a78bfa';
    ctx.fillRect(x+1, y+10+bob, 4, 6);
    ctx.fillRect(x+this.w-5, y+10+bob, 4, 6);
    // barra vida (tempo)
    const pct=clamp(this.life/this.duration,0,1);
    ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(x, y-7+bob, this.w, 4);
    ctx.fillStyle=pct>0.5?'#a78bfa':pct>0.25?'#facc15':'#ef4444'; ctx.fillRect(x, y-7+bob, this.w*pct, 4);
    // indicador tempo no topo
    ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.font='5px monospace'; ctx.textAlign='center';
    ctx.fillText(Math.ceil(this.life/1000)+'s', this.x, y-9+bob); ctx.textAlign='left';
  }
  getRect(){ return {x:this.x-this.w/2,y:this.y-this.h/2,w:this.w,h:this.h}; }
}

// ===================== FLECHA STAND (INCOMUM - HABILIDADE ALEATÓRIA) =====================
// Item incomum com 3 habilidades sorteadas. Modular: adicione nova entrada em this.abilities e ajuste chance.
// Cooldown único configurável (FLECHA_COOLDOWN), cada habilidade tem duração/efeito próprios configuráveis no topo.
class FlechaStand extends SpecialItem {
  constructor(){
    super({
      id: 'flecha_stand',
      name: 'FLECHA STAND',
      key: 'e',
      cooldown: FLECHA_COOLDOWN, // 10s (variável no topo)
      duration: 0, // instantâneo, mas cada habilidade controla seu próprio timer via Game
      icon: '🏹',
      description: 'Habilidade aleatória: Lentidão / Aliado / Paralisia',
      color: '#c084fc'
    });
    // Habilidade atual sorteada (para HUD dinâmica). Antes do primeiro uso é null.
    this.currentAbility = null;
    this.currentAbilityId = null;
    // Definições modulares das habilidades. Para adicionar nova: push({id, name, desc, chance, exec})
    // chance deve somar 1.0 no total; pode alterar FLECHA_CHANCES no topo.
    this.abilities = [
      {
        id: 'lentidao',
        name: 'Lentidão em Massa',
        desc: 'Reduz velocidade de inimigos em área',
        chance: FLECHA_CHANCES.lentidao,
        // exec recebe (player, game) e aplica efeito
        exec: (player, game) => this.execLentidao(player, game)
      },
      {
        id: 'aliado',
        name: 'Invocar Aliado',
        desc: 'Invoca Stand aliado temporário',
        chance: FLECHA_CHANCES.aliado,
        exec: (player, game) => this.execAliado(player, game)
      },
      {
        id: 'paralisia',
        name: 'Paralisia em Massa',
        desc: 'Paralisa inimigos por 5s',
        chance: FLECHA_CHANCES.paralisia,
        exec: (player, game) => this.execParalisia(player, game)
      }
    ];
    // Validação: normaliza chances se soma !=1 (evita erro de configuração)
    const sum=this.abilities.reduce((a,b)=>a+b.chance,0);
    if(Math.abs(sum-1) > 0.001){
      // normaliza proporcionalmente
      for(const ab of this.abilities) ab.chance/=sum;
    }
  }
  // Sorteia habilidade baseada em chance configurável (roleta viciável)
  rollAbility(){
    const r=Math.random();
    let acc=0;
    for(const ab of this.abilities){
      acc+=ab.chance;
      if(r < acc) return ab;
    }
    return this.abilities[this.abilities.length-1];
  }
  // Override: ao ativar, sorteia e executa. Salva currentAbility para HUD.
  activate(player, game){
    const chosen=this.rollAbility();
    this.currentAbility=chosen;
    this.currentAbilityId=chosen.id;
    // Executa habilidade escolhida
    chosen.exec(player, game);
    // Efeito sonoro/visual genérico da flecha
    for(let k=0;k<10;k++) game.particles.push(new Particle(player.x,player.y, randRange(-1.6,1.6), randRange(-1.6,0.6), 300, '#c084fc', 2));
    game.shake=Math.max(game.shake, 80);
  }
  // Permite adicionar nova habilidade em runtime: flecha.addAbility({id,name,desc,chance,exec})
  addAbility(abilityDef){
    this.abilities.push(abilityDef);
    // renormaliza para somar 1
    const sum=this.abilities.reduce((a,b)=>a+b.chance,0);
    for(const ab of this.abilities) ab.chance/=sum;
  }
  // --- Habilidade 1: Lentidão em Massa ---
  execLentidao(player, game){
    const room=game.currentRoom;
    if(!room) return;
    const cx=player.x, cy=player.y;
    let affected=0;
    // Área visual
    room.explosions.push({x:cx,y:cy,radius:14,life:500,max:500,isSlow:true});
    for(const e of room.enemies){
      if(e.dead) continue;
      const d=dist(cx,cy,e.x,e.y);
      if(d < FLECHA_SLOW_RADIUS){
        // Aplica lentidão: guarda velocidade original se não tiver
        if(e._baseSpeed===undefined) e._baseSpeed=e.speed;
        e.slowTimer=FLECHA_SLOW_DURATION;
        e.slowFactor=FLECHA_SLOW_FACTOR;
        e.slowVisual=true;
        affected++;
        // partículas gelo
        for(let k=0;k<5;k++) game.particles.push(new Particle(e.x,e.y, randRange(-1.2,1.2), randRange(-1.2,0.4), 400, '#60a5fa', 2));
      }
    }
    // círculo de área
    for(let k=0;k<18;k++){ const ang=(k/18)*Math.PI*2; const rx=cx+Math.cos(ang)*FLECHA_SLOW_RADIUS, ry=cy+Math.sin(ang)*FLECHA_SLOW_RADIUS; game.particles.push(new Particle(rx,ry, randRange(-0.3,0.3), randRange(-0.3,0.3), 500, 'rgba(96,165,250,0.9)', 2)); }
  }
  // --- Habilidade 2: Invocar Aliado ---
  execAliado(player, game){
    // Posição perto do jogador sem colidir parede
    let sx=player.x + randRange(-28,28), sy=player.y + randRange(-28,28), tries=0;
    const walls=game.currentRoom?game.currentRoom.walls:[];
    while(tries<12){
      let onWall=false;
      for(const w of walls) if(rectCollide(sx-13,sy-13,26,26,w.x,w.y,w.w,w.h)) {onWall=true; break;}
      if(!onWall) break;
      sx=player.x + randRange(-40,40); sy=player.y + randRange(-40,40); tries++;
    }
    sx=clamp(sx, WALL_THICK+20, CANVAS_W-WALL_THICK-20);
    sy=clamp(sy, WALL_THICK+20, CANVAS_H-WALL_THICK-20);
    const ally=new StandAlly(sx,sy);
    // Game gerencia lista de aliados (ver Game.allies)
    if(!game.allies) game.allies=[];
    game.allies.push(ally);
    // Efeito invocação
    for(let k=0;k<20;k++){ const ang=Math.random()*Math.PI*2; game.particles.push(new Particle(sx,sy, Math.cos(ang)*randRange(1.2,3.8), Math.sin(ang)*randRange(1.2,3.8), 460, '#a78bfa', 3)); }
    for(let k=0;k<8;k++) game.particles.push(new Particle(sx,sy, randRange(-1,1), randRange(-1,0.6), 350, '#ffffff', 2));
  }
  // --- Habilidade 3: Paralisia em Massa (5s) ---
  execParalisia(player, game){
    const room=game.currentRoom;
    if(!room) return;
    const cx=player.x, cy=player.y;
    let affected=0;
    room.explosions.push({x:cx,y:cy,radius:14,life:520,max:520,isParalyze:true});
    for(const e of room.enemies){
      if(e.dead) continue;
      const d=dist(cx,cy,e.x,e.y);
      if(d < FLECHA_STUN_RADIUS){
        e.stunTimer=FLECHA_STUN_DURATION; // 5s
        e.stunVisual=true;
        affected++;
        for(let k=0;k<6;k++) game.particles.push(new Particle(e.x,e.y, randRange(-1.4,1.4), randRange(-1.4,0.4), 500, '#ffd700', 2));
        // estrelinhas sobre cabeça
        for(let k=0;k<3;k++) game.particles.push(new Particle(e.x+randRange(-8,8), e.y-10+randRange(-4,4), randRange(-0.4,0.4), -0.6, 420, '#ffff00', 1.5));
      }
    }
    for(let k=0;k<20;k++){ const ang=(k/20)*Math.PI*2; const rx=cx+Math.cos(ang)*FLECHA_STUN_RADIUS, ry=cy+Math.sin(ang)*FLECHA_STUN_RADIUS; game.particles.push(new Particle(rx,ry, randRange(-0.3,0.3), randRange(-0.3,0.3), 520, 'rgba(255,215,0,0.95)', 2)); }
  }
  // Para HUD: retorna nome da habilidade atual ou placeholder antes do primeiro uso
  getCurrentAbilityName(){
    if(this.currentAbility) return this.currentAbility.name;
    return 'Aleatória (pressione E)';
  }
  getCurrentAbilityDesc(){
    if(this.currentAbility) return this.currentAbility.desc;
    return 'Sorteia Lentidão / Aliado / Paralisia';
  }
  // Sobrescreve getStatusText para mostrar habilidade + cooldown
  getStatusText(){
    // Mantém compatibilidade mas HUD usará getCurrentAbilityName separadamente
    return super.getStatusText();
  }
}

// ===================== GATO ANTIVÍRUS (INCOMUM - COMPANHEIRO AZUL) =====================
// Item incomum: ao pegar, invoca gato azul que detecta inimigo, corre até ele, ataca + atordoa, volta e fica 2s sem atacar.
// Modular: constantes no topo (GATO_ANTIVIRUS_*) fáceis de balancear. Gato é persistente enquanto item equipado.
// Lógica: state machine seguindo -> buscando -> atacando -> retornando -> cooldown 2s -> seguindo ...
class GatoAntivirus {
  constructor(x, y, player){
    this.x = x; this.y = y;
    this.w = 26; this.h = 26;
    this.player = player; // referência para seguir
    this.speed = GATO_ANTIVIRUS_SPEED; // configurável
    this.detectRadius = GATO_ANTIVIRUS_DETECT_RADIUS; // configurável
    this.damage = GATO_ANTIVIRUS_DAMAGE; // configurável
    this.stunDuration = GATO_ANTIVIRUS_STUN_DURATION; // configurável
    this.attackRange = GATO_ANTIVIRUS_ATTACK_RANGE; // configurável
    this.state = 'following'; // 'following' | 'seeking' | 'returning' | 'cooldown'
    this.target = null;
    this.cooldownTimer = 0; // 2s após voltar (requisito)
    this.anim = Math.random()*1000;
    this.hitFlash = 0;
    this.tailWag = 0;
    // offset aleatório perto do jogador para não ficar exatamente em cima
    this.returnOffset = { x: randRange(-26,26), y: randRange(-26,26) };
  }
  updateReturnOffset(){
    this.returnOffset.x = randRange(-26,26);
    this.returnOffset.y = randRange(-22,22);
  }
  moveWithWalls(vx, vy, walls){
    let nx = this.x + vx;
    let ny = this.y + vy;
    let canX=true, canY=true;
    const hw=this.w/2, hh=this.h/2;
    for(const w of walls){
      if(rectCollide(nx-hw, this.y-hh, this.w, this.h, w.x,w.y,w.w,w.h)) canX=false;
      if(rectCollide(this.x-hw, ny-hh, this.w, this.h, w.x,w.y,w.w,w.h)) canY=false;
    }
    if(canX) this.x=nx;
    if(canY) this.y=ny;
  }
  followPlayer(walls){
    const tx = this.player.x + this.returnOffset.x;
    const ty = this.player.y + this.returnOffset.y;
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx,dy);
    if(d > 4){
      const n = normalize(dx,dy);
      // velocidade adaptativa: mais longe = mais rápido para alcançar
      const sp = this.speed * 0.88 * Math.min(1.25, 0.55 + d/70);
      this.moveWithWalls(n.x*sp, n.y*sp, walls);
    } else {
      // perto o suficiente: leve deriva / troca offset ocasional para não ficar estático
      if(Math.random() < 0.018) this.updateReturnOffset();
      // bob suave parado
      this.x += Math.sin(this.anim*0.0032)*0.22;
      this.y += Math.cos(this.anim*0.0027)*0.18;
    }
    // teleporte de segurança se ficou muito longe (troca de sala brusca ou preso)
    if(dist(this.x,this.y,this.player.x,this.player.y) > 340){
      this.x = this.player.x + randRange(-24,24);
      this.y = this.player.y + randRange(-24,24);
      this.state='cooldown';
      this.cooldownTimer = GATO_ANTIVIRUS_RETURN_COOLDOWN*0.6;
    }
  }
  // Atualiza IA, retorna true enquanto vivo (sempre, pois é persistente enquanto item equipado)
  update(dt, enemies, walls, particles){
    this.anim += dt;
    this.tailWag += dt*0.008;
    if(this.hitFlash>0) this.hitFlash-=dt;
    // Verifica se player morreu ou não existe? Se sim, fica parado
    if(!this.player) return true;
    // Máquina de estados conforme requisito: detectar -> ir até ele -> atacar+atordoar -> voltar -> 2s sem atacar
    switch(this.state){
      case 'cooldown': {
        this.cooldownTimer -= dt;
        this.followPlayer(walls);
        // partículas sutis de descanso (zzz) a cada 650ms
        if(Math.floor(this.anim/650) !== Math.floor((this.anim-dt)/650) && Math.random()<0.6){
          if(particles) particles.push(new Particle(this.x+randRange(-5,5), this.y-14, randRange(-0.25,0.25), -0.55, 520, 'rgba(96,165,250,0.9)', 1.4));
        }
        if(this.cooldownTimer <= 0){
          this.cooldownTimer = 0;
          this.state = 'following';
          this.updateReturnOffset();
        }
        break;
      }
      case 'seeking': {
        if(!this.target || this.target.dead){
          // perdeu alvo, volta
          this.state = 'returning';
          this.target = null;
          break;
        }
        // valida se alvo ainda dentro de alcance estendido (evita perseguir para sempre)
        const dToTarget = dist(this.x,this.y,this.target.x,this.target.y);
        if(dToTarget > this.detectRadius*1.7){
          this.state = 'returning';
          this.target = null;
          break;
        }
        const dx = this.target.x - this.x, dy = this.target.y - this.y;
        const d = Math.hypot(dx,dy)||1;
        if(d < this.attackRange){
          // CHEGOU: ataca e atordoa
          const died = this.target.takeDamage(this.damage);
          this.target.stunTimer = this.stunDuration;
          this.target.stunVisual = true;
          this.target.hitFlash = Math.max(this.target.hitFlash||0, 190);
          // knockback leve no inimigo
          this.target.x += (dx/d)*6;
          this.target.y += (dy/d)*6;
          this.hitFlash = 160;
          // partículas impacto azul + estrelas stun
          if(particles){
            for(let k=0;k<9;k++) particles.push(new Particle(this.target.x, this.target.y, randRange(-2.2,2.2), randRange(-2.0,0.6), 340, '#3b82f6', 2.4));
            for(let k=0;k<5;k++) particles.push(new Particle(this.target.x, this.target.y, randRange(-1.4,1.4), randRange(-1.4,0.3), 420, '#60a5fa', 2));
            for(let k=0;k<3;k++) particles.push(new Particle(this.target.x+randRange(-7,7), this.target.y-12+randRange(-5,3), randRange(-0.4,0.4), -0.6, 520, '#ffff00', 1.6));
            if(died){
              for(let k=0;k<12;k++){ const ang=Math.random()*Math.PI*2; particles.push(new Particle(this.target.x,this.target.y, Math.cos(ang)*randRange(1.5,4.2), Math.sin(ang)*randRange(1.5,4.2), 420, '#3b82f6', 2.2)); }
            }
          }
          // após atacar, volta para perto do jogador
          this.state = 'returning';
          this.target = null;
          this.updateReturnOffset();
        } else {
          const n = normalize(dx,dy);
          this.moveWithWalls(n.x*this.speed, n.y*this.speed, walls);
          // trilha sutil quando perseguindo
          if(particles && Math.random()<0.22) particles.push(new Particle(this.x, this.y+4, randRange(-0.6,0.6), randRange(-0.2,0.4), 180, 'rgba(59,130,246,0.55)', 1.2));
        }
        break;
      }
      case 'returning': {
        const tx = this.player.x + this.returnOffset.x;
        const ty = this.player.y + this.returnOffset.y;
        const dx = tx - this.x, dy = ty - this.y;
        const d = Math.hypot(dx,dy)||1;
        if(d < 14){
          // chegou perto do jogador -> inicia 2s sem atacar (requisito)
          this.state = 'cooldown';
          this.cooldownTimer = GATO_ANTIVIRUS_RETURN_COOLDOWN;
          // partículas de chegada
          if(particles){
            for(let k=0;k<8;k++) particles.push(new Particle(this.x,this.y, randRange(-1.3,1.3), randRange(-1.0,0.4), 260, '#60a5fa', 1.8));
          }
        } else {
          const n = normalize(dx,dy);
          // volta um pouco mais rápido para cumprir requisito de retorno
          this.moveWithWalls(n.x*this.speed*1.18, n.y*this.speed*1.18, walls);
          if(particles && Math.random()<0.14) particles.push(new Particle(this.x, this.y, randRange(-0.4,0.4), randRange(-0.2,0.3), 160, 'rgba(147,197,253,0.55)', 1.1));
        }
        break;
      }
      case 'following':
      default: {
        // se em cooldown ainda, não busca; mas estado following já garante cooldownTimer==0
        if(this.cooldownTimer > 0){
          // ainda em cooldown residual? deveria estar em state cooldown, mas corrige
          this.state='cooldown';
          break;
        }
        // busca alvo mais próximo dentro do raio de detecção
        let best=null, bestD=this.detectRadius;
        for(const e of enemies){
          if(e.dead) continue;
          const d = dist(this.x,this.y,e.x,e.y);
          if(d < bestD){ best=e; bestD=d; }
        }
        if(best){
          this.target = best;
          this.state='seeking';
        } else {
          this.followPlayer(walls);
        }
        break;
      }
    }
    // clamp dentro da arena
    this.x=clamp(this.x, WALL_THICK+this.w/2, CANVAS_W-WALL_THICK-this.w/2);
    this.y=clamp(this.y, WALL_THICK+this.h/2, CANVAS_H-WALL_THICK-this.h/2);
    return true; // persistente: só morre se item for removido externamente
  }
  draw(ctx){
    const x=this.x - this.w/2, y=this.y - this.h/2, bob=Math.sin(this.anim*0.009)*1.8;
    const isFlash=this.hitFlash>0 && Math.floor(this.hitFlash/40)%2===0;
    // sombra
    ctx.fillStyle='rgba(0,0,0,0.30)'; ctx.fillRect(x+2, y+this.h-3, this.w, 3);
    // aura azul com pulso diferente por estado
    const pulseState = this.state==='seeking' ? 0.65 : this.state==='returning' ? 0.5 : 0.33;
    const pulse=0.5+Math.sin(this.anim*0.008)*pulseState;
    ctx.fillStyle=`rgba(59,130,246,${0.13+pulse*0.08})`;
    ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.88+pulse*4, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle=`rgba(59,130,246,${0.32+pulse*0.16})`; ctx.lineWidth=1.3;
    ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.84, 0, Math.PI*2); ctx.stroke();
    // corpo gato (azul)
    ctx.fillStyle=isFlash?'#fff':'#3b82f6';
    // corpo principal arredondado
    ctx.fillRect(x+5, y+10+bob, this.w-10, this.h-13);
    // barriga clara
    ctx.fillStyle=isFlash?'#e0e7ff':'#dbeafe';
    ctx.fillRect(x+8, y+13+bob, this.w-16, this.h-16);
    // cabeça
    ctx.fillStyle=isFlash?'#fff':'#60a5fa';
    ctx.fillRect(x+6, y+2+bob, this.w-12, 10);
    // orelhas pontudas
    ctx.fillStyle=isFlash?'#fff':'#93c5fd';
    ctx.fillRect(x+6, y+0+bob, 6, 6); // orelha esq
    ctx.fillRect(x+this.w-12, y+0+bob, 6, 6); // orelha dir
    ctx.fillStyle=isFlash?'#dbeafe':'#1e3a8a';
    ctx.fillRect(x+8, y+2+bob, 2, 3);
    ctx.fillRect(x+this.w-10, y+2+bob, 2, 3);
    // olhos (amarelo/verde)
    ctx.fillStyle=isFlash?'#fff':'#facc15';
    ctx.fillRect(x+8, y+5+bob, 4, 3);
    ctx.fillRect(x+14, y+5+bob, 4, 3);
    ctx.fillStyle='#0f172a';
    ctx.fillRect(x+9, y+6+bob, 1.5, 1.5);
    ctx.fillRect(x+15, y+6+bob, 1.5, 1.5);
    // brilho olhos
    ctx.fillStyle='#fff';
    ctx.fillRect(x+9.5, y+6+bob, 0.7, 0.7);
    ctx.fillRect(x+15.5, y+6+bob, 0.7, 0.7);
    // nariz rosinha
    ctx.fillStyle=isFlash?'#fff':'#f472b6';
    ctx.fillRect(x+12, y+8+bob, 2, 1.5);
    // bigodes
    ctx.fillStyle='rgba(255,255,255,0.9)';
    ctx.fillRect(x+2, y+7+bob, 4, 0.7);
    ctx.fillRect(x+2, y+9+bob, 4, 0.7);
    ctx.fillRect(x+this.w-6, y+7+bob, 4, 0.7);
    ctx.fillRect(x+this.w-6, y+9+bob, 4, 0.7);
    // cauda balançando
    const tailX = x+this.w-3 + Math.sin(this.tailWag)*2.5;
    ctx.fillStyle=isFlash?'#fff':'#2563eb';
    ctx.fillRect(tailX, y+12+bob, 4, 8);
    ctx.fillStyle=isFlash?'#fff':'#dbeafe';
    ctx.fillRect(tailX+1, y+13+bob, 2, 2);
    // patinhas
    ctx.fillStyle=isFlash?'#fff':'#1d4ed8';
    ctx.fillRect(x+6, y+18+bob, 4, 4);
    ctx.fillRect(x+this.w-10, y+18+bob, 4, 4);
    // indicador de estado (balão pequeno)
    if(this.state==='seeking'){
      ctx.fillStyle='#3b82f6';
      ctx.font='7px monospace'; ctx.textAlign='center';
      ctx.fillText('!', this.x, y-8+bob); ctx.textAlign='left';
    } else if(this.state==='returning'){
      ctx.fillStyle='rgba(96,165,250,0.95)';
      ctx.font='6px monospace'; ctx.textAlign='center';
      ctx.fillText('↵', this.x, y-7+bob); ctx.textAlign='left';
    } else if(this.state==='cooldown'){
      // barra 2s sem atacar + texto Zzz
      const pct=clamp(this.cooldownTimer/GATO_ANTIVIRUS_RETURN_COOLDOWN,0,1);
      ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(x, y-8+bob, this.w, 4);
      ctx.fillStyle= pct>0.5 ? '#60a5fa' : pct>0.25 ? '#facc15' : '#ef4444';
      ctx.fillRect(x, y-8+bob, this.w*(1-pct), 4);
      ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.font='5px monospace'; ctx.textAlign='center';
      ctx.fillText('zZ', this.x, y-11+bob); ctx.textAlign='left';
    } else {
      // following - patinha sutil
      if(Math.floor(this.anim/700)%2===0){
        ctx.fillStyle='rgba(255,255,255,0.18)';
        ctx.beginPath(); ctx.arc(this.x, this.y+this.h/2+3+bob, 2, 0, Math.PI*2); ctx.fill();
      }
    }
  }
  getRect(){ return {x:this.x-this.w/2,y:this.y-this.h/2,w:this.w,h:this.h}; }
}

// Item incomum Gato Antivírus - invoca companheiro azul persistente
class GatoAntivirusItem extends SpecialItem {
  constructor(){
    super({
      id: 'gato_antivirus',
      name: 'GATO ANTIVÍRUS',
      key: 'e',
      cooldown: GATO_ANTIVIRUS_COOLDOWN, // 4.5s para chamar de volta via E
      duration: 0, // instantâneo / passivo - gato fica ativo enquanto equipado
      icon: '🐱',
      description: 'Invoca gato azul que caça, atordoa e volta (2s repouso)',
      color: '#3b82f6'
    });
  }
  activate(player, game){
    // Pressionar E chama gato de volta perto do jogador e reseta parte do repouso
    // Se gato não existe (caso raro de dessync), cria um imediatamente
    if(!game.gatoAntivirus) game.gatoAntivirus=[];
    if(game.gatoAntivirus.length>0){
      const cat = game.gatoAntivirus[0];
      cat.x = player.x + randRange(-14,14);
      cat.y = player.y + randRange(-14,14);
      // força retorno + cooldown reduzido (chamar de volta = metade do repouso)
      cat.state='cooldown';
      cat.cooldownTimer = GATO_ANTIVIRUS_RETURN_COOLDOWN*0.65;
      cat.target=null;
      cat.hitFlash=140;
      cat.updateReturnOffset();
      for(let k=0;k<14;k++) game.particles.push(new Particle(cat.x,cat.y, randRange(-1.8,1.8), randRange(-1.8,0.6), 340, '#60a5fa', 2.2));
      for(let k=0;k<6;k++) game.particles.push(new Particle(cat.x,cat.y, randRange(-1,1), randRange(-1,0.5), 260, '#ffffff', 1.6));
      game.shake=Math.max(game.shake, 55);
      if(game.showToast) game.showToast('🐱 Gato chamado de volta! Repouso 1.3s', 1300);
    } else {
      // cria gato agora
      const sx = player.x + randRange(-28,28), sy = player.y + randRange(-28,28);
      const cat = new GatoAntivirus(clamp(sx,WALL_THICK+18,CANVAS_W-WALL_THICK-18), clamp(sy,WALL_THICK+18,CANVAS_H-WALL_THICK-18), player);
      game.gatoAntivirus.push(cat);
      for(let k=0;k<18;k++){ const ang=Math.random()*Math.PI*2; game.particles.push(new Particle(sx,sy, Math.cos(ang)*randRange(1.4,3.6), Math.sin(ang)*randRange(1.4,3.6), 420, '#3b82f6', 2.4)); }
      game.shake=Math.max(game.shake, 70);
      if(game.showToast) game.showToast('🐱 GATO ANTIVÍRUS invocado! Caça automática.', 1800);
    }
  }
  // HUD: mostra estado do gato + cooldown do E
  getStatusText(){
    // Se gato existe, mostra estado detalhado; senão, mostra cooldown padrão
    try{
      const g = (typeof window!=='undefined' && window.game && window.game.gatoAntivirus && window.game.gatoAntivirus[0]) ? window.game.gatoAntivirus[0] : null;
      if(g){
        if(g.state==='cooldown') return `Repouso: ${Math.ceil(g.cooldownTimer/1000)}s • E chama`;
        if(g.state==='seeking') return 'Caçando... • E chama';
        if(g.state==='returning') return 'Retornando...';
        return 'Patrulhando • Pronto!';
      }
    }catch(e){}
    if(this.isOnCooldown()) return `Chamar: ${this.getRemainingSeconds()}s`;
    return 'Pronto! [E] chamar';
  }
}

// ===================== POWER STAR ⭐ (RARO) =====================
// Item especial raro: invencibilidade + dano por contato + efeito visual.
// Modular: cooldown/duração/dano são constantes configuráveis no topo.
class PowerStar extends SpecialItem {
  constructor(){
    super({
      id: 'power_star',
      name: 'POWER STAR',
      key: 'e',
      cooldown: POWER_STAR_COOLDOWN, // 50s
      duration: POWER_STAR_DURATION, // 7s ativo
      icon: '⭐',
      description: 'Fica invencível e causa dano ao tocar inimigos',
      color: '#ffd700'
    });
    this.touchDamage = POWER_STAR_DAMAGE;
    this.tickVisual = 0;
    this.pulseTime = 0;
  }
  activate(player, game){
    // Ativa flags no player - Player.isInvulnerable() verifica isso
    player.powerStarActive = true;
    player.powerStarTimer = this.duration;
    player.powerStarDamage = this.touchDamage;
    // Inicializa cooldown de toque por inimigo (Map enemy -> timer)
    if(!player.powerStarHitTimers) player.powerStarHitTimers = new Map();
    else player.powerStarHitTimers.clear();
    // Efeitos iniciais
    for(let k=0;k<22;k++){ const ang=Math.random()*Math.PI*2, sp=randRange(1.4,4.2); const col=['#ffd700','#ffed4e','#fff8a0','#ffaa00'][randInt(0,3)]; game.particles.push(new Particle(player.x, player.y, Math.cos(ang)*sp, Math.sin(ang)*sp, randRange(340,560), col, randInt(3,5))); }
    for(let k=0;k<10;k++) game.particles.push(new Particle(player.x, player.y, randRange(-1.5,1.5), randRange(-1.6,0.6), 420, '#ffffff', 2));
    game.shake = Math.max(game.shake, 90);
  }
  onActiveTick(dt, player, game){
    this.tickVisual += dt;
    this.pulseTime += dt;
    player.powerStarTimer = this.durationRemaining; // sincroniza HUD/player
    // Aura visual pulsante + estrelas orbitando
    if(Math.random() < 0.38){
      const ang = Math.random()*Math.PI*2;
      const r = 20 + Math.sin(this.pulseTime*0.008)*4;
      const px = player.x + Math.cos(ang)*r;
      const py = player.y + Math.sin(ang)*r;
      game.particles.push(new Particle(px, py, randRange(-0.5,0.5), randRange(-0.9,-0.2), 280, 'rgba(255,215,0,0.95)', 1.8));
    }
    if(Math.random() < 0.18){
      const ang = this.pulseTime*0.004 + Math.random()*0.6;
      const r = 26;
      const px = player.x + Math.cos(ang)*r;
      const py = player.y + Math.sin(ang)*r - 2;
      game.particles.push(new Particle(px, py, Math.cos(ang)*0.6, Math.sin(ang)*0.6, 260, '#fff8a0', 1.2));
    }
    // Brilho extra a cada 0.5s
    if(Math.floor(this.tickVisual/500) !== Math.floor((this.tickVisual-dt)/500)){
      game.particles.push(new Particle(player.x, player.y, randRange(-0.7,0.7), -1.0, 200, '#ffd700', 1.2));
    }
    // Mantém flag ativa e garante invencibilidade enquanto isActive
    player.powerStarActive = true;
  }
  onDeactivate(player, game){
    player.powerStarActive = false;
    player.powerStarTimer = 0;
    if(player.powerStarHitTimers) player.powerStarHitTimers.clear();
    // Efeito de fim: explosão dourada sutil + shake
    for(let k=0;k<16;k++){ const ang=Math.random()*Math.PI*2; game.particles.push(new Particle(player.x, player.y, Math.cos(ang)*randRange(1.6,3.8), Math.sin(ang)*randRange(1.2,3.2), 380, '#ffd700', 2)); }
    game.shake = Math.max(game.shake, 70);
  }
  playEffects(player, game){}
}

// ===================== FARMAR AURA (67) - EXCLUSIVO JL =====================
// Item exclusivo de JL: cria área em volta que CAUSA DANO e EMPURRA inimigos
// Mecânica durativa: aura segue o jogador por FARMAR_AURA_DURATION, causa dano por tick e empurra continuamente
// Ícone requisitado: "67" (string literal) - renderizado como texto na HUD e no chão
const FARMAR_AURA_COOLDOWN = 12000; // 12s recarga (variável balanceável)
const FARMAR_AURA_RADIUS = 155; // raio da área de dano+empurrão (configurável)
const FARMAR_AURA_DURATION = 3800; // ms que a aura fica ativa ao redor do jogador
const FARMAR_AURA_DAMAGE = 1; // dano por tick dentro da aura
const FARMAR_AURA_TICK_RATE = 420; // ms entre ticks de dano+push
const FARMAR_AURA_PUSH_FORCE = 16; // força por tick (menor que burst inicial, para empurrão contínuo suave)
const FARMAR_AURA_INITIAL_PUSH = 28; // força do burst inicial ao ativar
const FARMAR_AURA_STUN = 180; // micro stun por tick
class FarmarAura extends SpecialItem {
  constructor(){
    super({
      id: 'farmar_aura',
      name: 'FARMAR AURA',
      key: 'e',
      cooldown: FARMAR_AURA_COOLDOWN,
      duration: FARMAR_AURA_DURATION, // durativa - aura segue jogador
      icon: '67', // ícone requisitado: 67
      description: 'Cria área em volta que causa dano e empurra inimigos continuamente',
      color: '#ff6b9d'
    });
    this.radius = FARMAR_AURA_RADIUS;
    this.pushForce = FARMAR_AURA_PUSH_FORCE;
    this.damage = FARMAR_AURA_DAMAGE;
    this.tickRate = FARMAR_AURA_TICK_RATE;
    this._tickTimer = 0;
    this._auraRef = null;
  }
  activate(player, game){
    const cx = player.x, cy = player.y;
    const room = game.currentRoom;
    if(!room) return;
    // Marca no player para desenho seguir jogador
    player.farmarAuraActive = true;
    player.farmarAuraRadius = this.radius;
    player.farmarAuraDamage = this.damage;
    this._tickTimer = this.tickRate; // causa tick imediato no próximo update, mas também faz burst inicial agora
    // Anel de ativação visual central
    room.explosions.push({x:cx, y:cy, radius:14, life:520, max:520, isFarmarAura:true});
    // Aura que segue o jogador (follow:true)
    if(!room.farmarAuras) room.farmarAuras=[];
    const aura={x:cx, y:cy, radius:0, maxRadius:this.radius, life:this.duration, maxLife:this.duration, follow:true, owner:player};
    room.farmarAuras.push(aura);
    this._auraRef = aura;
    // Burst inicial: dano + empurrão forte imediato
    const particles = game.particles;
    let pushedCount=0;
    let damagedCount=0;
    for(const e of room.enemies){
      if(e.dead) continue;
      if(e.type==='stair_boss' && e.getHands){
        const dHead = dist(cx,cy,e.x,e.y);
        if(dHead < this.radius+18){
          const died=e.takeDamage(this.damage);
          damagedCount++;
          const ang=Math.atan2(e.y-cy,e.x-cx)||Math.random()*Math.PI*2;
          const falloff=1 - Math.min(dHead/this.radius,1);
          const force=FARMAR_AURA_INITIAL_PUSH*(0.6+falloff*0.8)*0.55;
          e.x+=Math.cos(ang)*force; e.y+=Math.sin(ang)*force;
          e.hitFlash=180;
          e.x=clamp(e.x,WALL_THICK+e.w/2,CANVAS_W-WALL_THICK-e.w/2);
          e.y=clamp(e.y,WALL_THICK+e.h/2,CANVAS_H-WALL_THICK-e.h/2);
          for(let k=0;k<4;k++) particles.push(new Particle(e.x,e.y, Math.cos(ang)*randRange(0.8,1.6), Math.sin(ang)*randRange(0.8,1.6), 220, '#ff6b9d',2));
          if(died) for(let k=0;k<8;k++){const ang2=Math.random()*Math.PI*2; particles.push(new Particle(e.x,e.y, Math.cos(ang2)*randRange(1.2,3), Math.sin(ang2)*randRange(1.2,3), 300, '#ff6b9d',2));}
        }
        for(const hand of e.getHands()){
          if(hand.dead) continue;
          const d=dist(cx,cy,hand.x,hand.y);
          if(d<this.radius){
            const died=hand.takeDamage(this.damage);
            damagedCount++;
            const ang=Math.atan2(hand.y-cy,hand.x-cx)||Math.random()*Math.PI*2;
            const falloff=1 - d/this.radius;
            const force=FARMAR_AURA_INITIAL_PUSH*(0.7+falloff*0.6);
            hand.x+=Math.cos(ang)*force; hand.y+=Math.sin(ang)*force*0.7;
            hand.hitFlash=160;
            hand.x=clamp(hand.x,WALL_THICK+hand.w/2,CANVAS_W-WALL_THICK-hand.w/2);
            hand.y=clamp(hand.y,WALL_THICK+hand.h/2,CANVAS_H-WALL_THICK-hand.h/2);
            for(let k=0;k<3;k++) particles.push(new Particle(hand.x,hand.y, Math.cos(ang)*randRange(0.6,1.8), Math.sin(ang)*randRange(0.6,1.8), 260, '#ff6b9d',2));
            if(died) for(let k=0;k<6;k++){const ang2=Math.random()*Math.PI*2; particles.push(new Particle(hand.x,hand.y, Math.cos(ang2)*randRange(1.2,3), Math.sin(ang2)*randRange(1.2,3), 260, '#ff6b9d',2));}
          }
        }
        continue;
      }
      const d=dist(cx,cy,e.x,e.y);
      if(d < this.radius){
        const died=e.takeDamage(this.damage);
        damagedCount++;
        const ang=Math.atan2(e.y-cy,e.x-cx)||Math.random()*Math.PI*2;
        const falloff=1 - d/this.radius;
        const force=FARMAR_AURA_INITIAL_PUSH*(0.6+falloff*0.9);
        e.x+=Math.cos(ang)*force; e.y+=Math.sin(ang)*force;
        e.hitFlash=Math.max(e.hitFlash||0,160);
        if(e.stunTimer!==undefined && e.type!=='miniboss' && e.type!=='stair_boss'){
          e.stunTimer=Math.max(e.stunTimer||0, FARMAR_AURA_STUN+falloff*80);
        }
        let onWall=false;
        if(room.walls) for(const w of room.walls) if(rectCollide(e.x-e.w/2,e.y-e.h/2,e.w,e.h,w.x,w.y,w.w,w.h)){onWall=true;break;}
        if(onWall){e.x-=Math.cos(ang)*force*0.5; e.y-=Math.sin(ang)*force*0.5;}
        e.x=clamp(e.x,WALL_THICK+e.w/2,CANVAS_W-WALL_THICK-e.w/2);
        e.y=clamp(e.y,WALL_THICK+e.h/2,CANVAS_H-WALL_THICK-e.h/2);
        for(let k=0;k<4;k++) particles.push(new Particle(e.x,e.y, Math.cos(ang)*randRange(0.6,1.6), Math.sin(ang)*randRange(0.6,1.6), 240, '#ff6b9d',2));
        pushedCount++;
      }
    }
    // Partículas de borda indicando área
    for(let k=0;k<22;k++){ const ang=(k/22)*Math.PI*2; const rx=cx+Math.cos(ang)*this.radius, ry=cy+Math.sin(ang)*this.radius; particles.push(new Particle(rx,ry, randRange(-0.3,0.3), randRange(-0.3,0.3), 520, 'rgba(255,107,157,0.95)',2)); }
    for(let k=0;k<26;k++){ const ang=Math.random()*Math.PI*2, sp=randRange(2.2,6.5); const col=['#ff6b9d','#ff8fae','#ffd1dc','#ffffff'][randInt(0,3)]; particles.push(new Particle(cx,cy, Math.cos(ang)*sp, Math.sin(ang)*sp, randRange(300,520), col, randInt(3,6))); }
    for(let k=0;k<12;k++) particles.push(new Particle(cx+randRange(-12,12), cy+randRange(-12,12), randRange(-1,1), randRange(-2,-0.4), 400, 'rgba(255,107,157,0.9)',2));
    game.shake=Math.max(game.shake, 100);
    if(game.showToast) game.showToast(`67 FARMAR AURA! Área de ${this.duration/1000}s • ${damagedCount} danos • ${pushedCount} empurrados`, 1900);
  }
  onActiveTick(dt, player, game){
    // Mantém aura seguindo jogador (posição atualizada, vida/radius gerenciados por Room)
    if(this._auraRef){
      this._auraRef.x = player.x;
      this._auraRef.y = player.y;
      // life e radius são gerenciados pelo Room.update para evitar double-decrement
    }
    player.farmarAuraActive = true;
    player.farmarAuraRadius = this.radius;
    // Tick de dano + empurrão contínuo dentro da área
    this._tickTimer += dt;
    if(this._tickTimer >= this.tickRate){
      this._tickTimer = 0;
      const cx=player.x, cy=player.y;
      const room=game.currentRoom;
      if(!room) return;
      let tickDamaged=0;
      for(const e of room.enemies){
        if(e.dead) continue;
        if(e.type==='stair_boss' && e.getHands){
          const dHead=dist(cx,cy,e.x,e.y);
          if(dHead < this.radius){
            const died=e.takeDamage(this.damage);
            tickDamaged++;
            e.hitFlash=130;
            const ang=Math.atan2(e.y-cy,e.x-cx)||Math.random()*Math.PI*2;
            e.x+=Math.cos(ang)*6; e.y+=Math.sin(ang)*6;
            e.x=clamp(e.x,WALL_THICK+e.w/2,CANVAS_W-WALL_THICK-e.w/2);
            e.y=clamp(e.y,WALL_THICK+e.h/2,CANVAS_H-WALL_THICK-e.h/2);
            for(let k=0;k<3;k++) game.particles.push(new Particle(e.x,e.y, Math.cos(ang)*randRange(0.6,1.2), Math.sin(ang)*randRange(0.6,1.2), 200, '#ff6b9d',2));
            if(died) for(let k=0;k<8;k++){const ang2=Math.random()*Math.PI*2; game.particles.push(new Particle(e.x,e.y, Math.cos(ang2)*randRange(1.2,3), Math.sin(ang2)*randRange(1.2,3), 280, '#ff6b9d',2));}
          }
          for(const hand of e.getHands()){
            if(hand.dead) continue;
            const d=dist(cx,cy,hand.x,hand.y);
            if(d<this.radius){
              const died=hand.takeDamage(this.damage);
              tickDamaged++;
              hand.hitFlash=130;
              const ang=Math.atan2(hand.y-cy,hand.x-cx)||Math.random()*Math.PI*2;
              hand.x+=Math.cos(ang)*this.pushForce*0.35;
              hand.y+=Math.sin(ang)*this.pushForce*0.25;
              hand.x=clamp(hand.x,WALL_THICK+hand.w/2,CANVAS_W-WALL_THICK-hand.w/2);
              hand.y=clamp(hand.y,WALL_THICK+hand.h/2,CANVAS_H-WALL_THICK-hand.h/2);
              for(let k=0;k<2;k++) game.particles.push(new Particle(hand.x,hand.y, Math.cos(ang)*randRange(0.5,1.2), Math.sin(ang)*randRange(0.5,1.2), 200, '#ff6b9d',2));
              if(died) for(let k=0;k<6;k++){const ang2=Math.random()*Math.PI*2; game.particles.push(new Particle(hand.x,hand.y, Math.cos(ang2)*randRange(1.2,3), Math.sin(ang2)*randRange(1.2,3), 260, '#ff6b9d',2));}
            }
          }
          continue;
        }
        const d=dist(cx,cy,e.x,e.y);
        if(d < this.radius){
          const died=e.takeDamage(this.damage);
          tickDamaged++;
          e.hitFlash=Math.max(e.hitFlash||0,120);
          const ang=Math.atan2(e.y-cy,e.x-cx)||Math.random()*Math.PI*2;
          const falloff=1 - d/this.radius;
          const force=this.pushForce*(0.45+falloff*0.55)*0.62;
          e.x+=Math.cos(ang)*force;
          e.y+=Math.sin(ang)*force;
          if(e.stunTimer!==undefined && e.type!=='miniboss' && e.type!=='stair_boss'){
            e.stunTimer=Math.max(e.stunTimer||0, 90);
          }
          let onWall=false;
          if(room.walls) for(const w of room.walls) if(rectCollide(e.x-e.w/2,e.y-e.h/2,e.w,e.h,w.x,w.y,w.w,w.h)){onWall=true;break;}
          if(onWall){e.x-=Math.cos(ang)*force*0.5; e.y-=Math.sin(ang)*force*0.5;}
          e.x=clamp(e.x,WALL_THICK+e.w/2,CANVAS_W-WALL_THICK-e.w/2);
          e.y=clamp(e.y,WALL_THICK+e.h/2,CANVAS_H-WALL_THICK-e.h/2);
          for(let k=0;k<2;k++) game.particles.push(new Particle(e.x,e.y, Math.cos(ang)*randRange(0.5,1.1), Math.sin(ang)*randRange(0.5,1.1), 200, '#ff6b9d',2));
          if(died){
            for(let k=0;k<8;k++){const ang2=Math.random()*Math.PI*2; game.particles.push(new Particle(e.x,e.y, Math.cos(ang2)*randRange(1.2,3), Math.sin(ang2)*randRange(1.2,3), 280, '#ff6b9d',2));}
          }
        }
      }
      // Partículas de borda a cada tick para feedback de dano contínuo
      if(tickDamaged>0){
        for(let k=0;k<4;k++){
          const ang=Math.random()*Math.PI*2;
          const px=cx+Math.cos(ang)*this.radius*randRange(0.88,1);
          const py=cy+Math.sin(ang)*this.radius*randRange(0.88,1);
          game.particles.push(new Particle(px,py, Math.cos(ang)*randRange(0.4,1), Math.sin(ang)*randRange(0.4,1), 240, 'rgba(255,107,157,0.92)',1.8));
        }
        game.shake=Math.max(game.shake, 28);
      }
    }
    // Visual passivo: partículas internas
    if(Math.random()<0.24){
      game.particles.push(new Particle(player.x+randRange(-10,10), player.y+randRange(-10,10), randRange(-0.4,0.4), randRange(-0.6,0.2), 220, 'rgba(255,182,193,0.9)',1.5));
    }
  }
  onDeactivate(player, game){
    player.farmarAuraActive=false;
    if(this._auraRef){
      const room=game.currentRoom;
      if(room && room.farmarAuras){
        const idx=room.farmarAuras.indexOf(this._auraRef);
        if(idx!==-1) room.farmarAuras.splice(idx,1);
      }
      this._auraRef=null;
    }
    const cx=player.x, cy=player.y;
    if(game.currentRoom) game.currentRoom.explosions.push({x:cx,y:cy,radius:10,life:360,max:360,isFarmarAuraEnd:true});
    for(let k=0;k<18;k++){const ang=Math.random()*Math.PI*2; game.particles.push(new Particle(cx,cy, Math.cos(ang)*randRange(1.4,3.2), Math.sin(ang)*randRange(1.4,3.2), 300, '#ff6b9d',2));}
    game.shake=Math.max(game.shake,60);
    if(game.showToast) game.showToast('67 Aura dissipada', 900);
  }
  playEffects(player, game){}
}

// ===================== OLI - ITEM XADREZ (INVOCADOR) =====================
class OliXadrez extends SpecialItem {
  constructor(){
    super({
      id: 'oli_xadrez',
      name: 'XADREZ OLI',
      key: 'e',
      cooldown: OLI_COOLDOWN,
      duration: 0,
      icon: '♞',
      description: 'Invoca Torre, Bispo, Rainha e Rei em ciclo - cada peça com mecânica única',
      color: '#a78bfa'
    });
    this.pieces = [
      {id:'torre', name:'Torre ♜', desc:'Cruz (vertical/horizontal) + investida', icon:'♜', color:'#60a5fa'},
      {id:'bispo', name:'Bispo ♝', desc:'Diagonal contínua com ricochete', icon:'♝', color:'#a78bfa'},
      {id:'rainha', name:'Rainha ♛', desc:'Movimento livre + dispara projéteis', icon:'♛', color:'#c084fc'},
      {id:'rei', name:'Rei ♚', desc:'Invoca 3 peões perseguidores', icon:'♚', color:'#ffd700'}
    ];
    this.nextIndex = 0;
    this.currentPiece = null;
    this._gameRef = null;
  }
  // Verifica limite antes de ativar (reusa sistema de cooldown/limite existente)
  tryActivate(player, game){
    this._gameRef = game;
    if(game.oliPieces && game.oliPieces.length >= OLI_MAX_PIECES){
      if(game.showToast) game.showToast(`♟ Limite de ${OLI_MAX_PIECES} peças ativas! Aguarde expirar.`, 1400);
      return false;
    }
    return super.tryActivate(player, game);
  }
  getNextPieceName(){
    return this.pieces[this.nextIndex].name;
  }
  getNextPieceIcon(){
    return this.pieces[this.nextIndex].icon;
  }
  activate(player, game){
    this._gameRef = game;
    if(!game.oliPieces) game.oliPieces=[];
    if(!game.oliPawns) game.oliPawns=[];
    if(game.oliPieces.length >= OLI_MAX_PIECES){
      if(game.showToast) game.showToast(`♟ Limite ${OLI_MAX_PIECES} peças!`, 1400);
      this.cooldownRemaining = 0;
      return;
    }
    const choice = this.pieces[this.nextIndex];
    this.currentPiece = choice;
    let sx = player.x + randRange(-32,32), sy = player.y + randRange(-32,32), tries=0;
    const walls = game.currentRoom ? game.currentRoom.walls : [];
    while(tries<12){
      let onWall=false;
      for(const w of walls) if(rectCollide(sx-14,sy-14,28,28,w.x,w.y,w.w,w.h)){onWall=true;break;}
      if(!onWall && dist(sx,sy,player.x,player.y) > 28 && dist(sx,sy,player.x,player.y) < 80) break;
      sx=player.x+randRange(-42,42); sy=player.y+randRange(-42,42); tries++;
    }
    sx=clamp(sx, WALL_THICK+20, CANVAS_W-WALL_THICK-20);
    sy=clamp(sy, WALL_THICK+20, CANVAS_H-WALL_THICK-20);
    let piece=null;
    if(choice.id==='torre'){ piece=new TorrePiece(sx,sy,player); }
    else if(choice.id==='bispo'){ piece=new BispoPiece(sx,sy,player); }
    else if(choice.id==='rainha'){ piece=new RainhaPiece(sx,sy,player); }
    else if(choice.id==='rei'){ piece=new ReiPiece(sx,sy,player, game.oliPawns); }
    if(piece){
      game.oliPieces.push(piece);
      const col=choice.color;
      for(let k=0;k<16;k++){ const ang=Math.random()*Math.PI*2; game.particles.push(new Particle(sx,sy, Math.cos(ang)*randRange(1.4,3.6), Math.sin(ang)*randRange(1.4,3.6), 420, col, 2.5)); }
      for(let k=0;k<8;k++) game.particles.push(new Particle(sx,sy, randRange(-1,1), randRange(-1,0.6), 320, '#ffffff',1.8));
      game.shake=Math.max(game.shake, 70);
      const nextName = this.pieces[(this.nextIndex+1)%this.pieces.length].name;
      if(game.showToast) game.showToast(`${choice.icon} ${choice.name} invocada! Próxima: ${nextName}`, 2000);
      this.nextIndex = (this.nextIndex+1)%this.pieces.length;
    }
  }
  getStatusText(){
    if(this.isOnCooldown()) return `Cooldown: ${this.getRemainingSeconds()}s • Próxima: ${this.getNextPieceName()}`;
    return `Pronto! Próxima: ${this.getNextPieceName()}`;
  }
  playEffects(player, game){}
}

// Registro modular: facilita adicionar novos itens sem reescrever Game/Player
// Basta criar classe nova extends SpecialItem e adicionar aqui.
const SPECIAL_REGISTRY = {
  'espada_flamejante': () => new EspadaFlamejante(),
  'escudo_magico':     () => new EscudoMagico(),
  'flecha_stand':      () => new FlechaStand(),
  'power_star':        () => new PowerStar(),
  'farmar_aura':       () => new FarmarAura(),
  'oli_xadrez':        () => new OliXadrez(),
};
function createSpecialItem(id){
  const factory = SPECIAL_REGISTRY[id];
  if(!factory){ console.warn(`SpecialItem id desconhecido: ${id}`); return null; }
  return factory();
}
// Lista para spawn aleatório / debug
const SPECIAL_ITEM_IDS = Object.keys(SPECIAL_REGISTRY);

// ===================== SISTEMA DE MELHORIAS (UPGRADES) =====================
// 4 níveis de raridade com cores distintas (requisito)
const RARITY = {
  COMUM:      { id:'COMUM',      name:'Comum',      color:'#d1d5db', bg:'rgba(209,213,219,0.22)', border:'rgba(209,213,219,0.55)', glow:'rgba(209,213,219,0.25)', chance:0.50 },
  INCOMUM:    { id:'INCOMUM',    name:'Incomum',    color:'#4ade80', bg:'rgba(74,222,128,0.22)', border:'rgba(74,222,128,0.65)', glow:'rgba(74,222,128,0.35)', chance:0.30 },
  RARA:       { id:'RARA',       name:'Rara',       color:'#60a5fa', bg:'rgba(96,165,250,0.22)', border:'rgba(96,165,250,0.65)', glow:'rgba(96,165,250,0.35)', chance:0.15 },
  MUITO_RARA: { id:'MUITO_RARA', name:'Muito Rara', color:'#c084fc', bg:'rgba(192,132,252,0.22)', border:'rgba(192,132,252,0.70)', glow:'rgba(192,132,252,0.35)', gold:'#ffd700' }
};
// Valores balanceados facilmente editáveis por raridade/arma (requisito balanceamento)
const UPGRADE_VALUES = {
  // NORMAL - pistola equilibrada
  NORMAL_COMUM_SPEED: 0.10,        // +10% vel projétil
  NORMAL_INCOMUM_COOLDOWN: 0.18,   // -18% cooldown
  NORMAL_RARA_DANO: 0.35,          // +35% dano
  NORMAL_MUITO_RARA_PIERCE: true,  // pierce especial
  // SHOTGUN - cone
  SHOTGUN_COMUM_RANGE: 0.12,       // +12% alcance
  SHOTGUN_COMUM_SPREAD_REDUC: 0.08,// -8% spread (precisão)
  SHOTGUN_INCOMUM_COUNT: 1,        // +1 pellet
  SHOTGUN_RARA_DANO: 0.25,         // +25% dano pellet
  SHOTGUN_MUITO_RARA_COUNT: 2,     // +2 pellets (total +3 se com incomum)
  SHOTGUN_MUITO_RARA_RANGE: 0.10,  // +10% alcance extra
  // RAIO - pierce
  RAIO_COMUM_COOLDOWN: 0.08,       // -8% cooldown
  RAIO_INCOMUM_SPEED: 0.15,        // +15% speed
  RAIO_INCOMUM_RANGE: 0.10,        // +10% range
  RAIO_RARA_DANO: 0.30,            // +30% dano
  RAIO_MUITO_RARA_CHAIN: 2,        // chain extra (especial)
  // METRALHADORA - heat
  METRA_COMUM_HEAT_REDUC: 0.10,    // -10% heat/shot
  METRA_INCOMUM_SPEED: 0.12,       // +12% speed
  METRA_INCOMUM_SPREAD: 0.05,      // -5% spread
  METRA_RARA_HEAT_REDUC: 0.25,     // -25% heat/shot extra
  METRA_RARA_COOL_BONUS: 0.15,     // +15% cool rate
  METRA_MUITO_RARA_HEAT_MAX: 0.20, // +20% heat max
  METRA_MUITO_RARA_NO_PENALTY: true,// remove penalidade velocidade
  // CARREGADA - carga
  CARG_COMUM_CHARGE_REDUC: 0.15,   // -15% max charge time
  CARG_INCOMUM_DANO_MAX: 0.20,     // +20% dano max
  CARG_RARA_SPEED: 0.30,           // +30% speed
  CARG_RARA_RANGE: 0.15,           // +15% range
  CARG_MUITO_RARA_PIERCE: true,    // pierce no max
  CARG_MUITO_RARA_EXTRA: 2,         // +2 projéteis em cone no max
  // ESPADA - espada curta com pesado
  ESPADA_COMUM_DANO: 0.15,          // +15% dano leve e pesado
  ESPADA_RARA_ALCANCE: 0.18,        // +18% alcance leve/pesado
  ESPADA_RARA_PREP_REDUC: 0.22,      // -22% tempo preparo pesado
  ESPADA_MUITO_RARA_ANGLE: 0.18,    // +18% ângulo
  ESPADA_MUITO_RARA_PIERCE: true,
  // NOVOS - ESPADA upgrades com mecânica de carga (balanceáveis)
  ESPADA_INCOMUM_WAVE_RANGE: 320,        // alcance do corte de vento
  ESPADA_INCOMUM_WAVE_SPEED: 9.2,        // velocidade do corte
  ESPADA_INCOMUM_WAVE_DMG_FACTOR: 0.78,  // dano do corte = heavyDamage * factor
  ESPADA_INCOMUM_WAVE_SIZE: 9,           // tamanho base do projétil corte
  ESPADA_RARA_GUARDIAO_SPEED: 0.32,      // +32% velocidade ao carregar
  ESPADA_RARA_GUARDIAO_SHIELD_MS: 1100,  // escudo dura ~1.1s após carregar/soltar
  // LUVA - punho foguete
  LUVA_COMUM_SPEED: 0.14,           // +14% velocidade ida
  LUVA_RARA_RANGE: 0.18,            // +18% alcance
  LUVA_MUITO_RARA_PIERCE: true,     // perfura 1 e volta mais rápido
  LUVA_MUITO_RARA_SPEED_RETURN: 0.18,
  // BASTÃO JG - bastão giratório
  BASTAO_COMUM_DANO: 0.14,           // +14% dano melee e arremesso
  BASTAO_COMUM_RANGE: 0.12,          // +12% alcance melee
  BASTAO_INCOMUM_SPEED: 0.18,        // +18% velocidade arremesso
  BASTAO_INCOMUM_RANGE_THROW: 0.16,  // +16% alcance arremesso
  BASTAO_RARA_DANO_THROW: 0.28,      // +28% dano arremesso
  BASTAO_RARA_COOLDOWN: 0.18,        // -18% cooldown melee
  BASTAO_MUITO_RARA_DANO: 0.32,      // +32% dano
  BASTAO_MUITO_RARA_PIERCE: true,    // perfura 1 ao arremessar
  BASTAO_MUITO_RARA_RETURN: 0.22,     // +22% velocidade retorno
  // MOTOSSERRA - incomum curta distância (raridade alterada para INCOMUM)
  MOTOSSERRA_COMUM_DANO: 0.18,        // +18% dano
  MOTOSSERRA_INCOMUM_COOLDOWN: 0.18,  // -18% cooldown
  MOTOSSERRA_RARA_ALCANCE: 0.22,      // +22% alcance
  MOTOSSERRA_RARA_ANGLE: 0.20,        // +20% ângulo
  MOTOSSERRA_MUITO_RARA_POCHITA_DANO: 0.55, // +55% dano pochita
  MOTOSSERRA_MUITO_RARA_POCHITA_RANGE: 0.18,
  MOTOSSERRA_MUITO_RARA_POCHITA_ANGLE: 0.38,
  // Novos valores gerais balanceados
  GERAL_COMUM_DANO: 0.12,             // +12% dano ALL
  GERAL_COMUM_ALCANCE: 0.10,          // +10% alcance ALL
  GERAL_INCOMUM_COOLDOWN: 0.15,       // -15% cooldown ALL
  GERAL_RARA_DANO_CRIT: 0.28,         // +28% dano geral raro
  // Especial - incomum: redução de recarga de itens especiais
  ESPECIAL_INCOMUM_COOLDOWN: 0.10, // -10% recarga especiais por acúmulo até 30%
  GERAL_MUITO_RARA_PIERCING: 1,       // +1 pierce geral
};
// Caps para evitar infinito/exagerado
const UPGRADE_CAPS = {
  MIN_COOLDOWN_FACTOR: 0.45, // não reduz cooldown abaixo de 45% do base
  MAX_DANO_FACTOR: 2.2,      // dano no máximo 2.2x base
  MAX_RANGE_FACTOR: 1.6,     // range no máximo 1.6x
  MAX_COUNT: 10,             // pellets no máximo 10
  MAX_BULLET_SPEED_FACTOR: 1.8,
  MIN_SPREAD_FACTOR: 0.35,   // spread não menor que 35% do base
  MIN_HEAT_FACTOR: 0.40,     // heat não menor que 40%
  MIN_CHARGE_TIME: 500,       // charge máx não menor que 500ms
  MAX_PERFURACAO: 3          // máximo inimigos atravessados
};
// Valores configuráveis por nível (exemplo enunciado - fácil editar)
const UPGRADE_LEVEL_VALUES = {
  ALCANCE: [0.15, 0.30, 0.50],       // +15% / +30% / +50% alcance
  RECARGA: [0.10, 0.20, 0.30],       // -10% / -20% / -30% recarga (cooldown)
  CARREGAMENTO: [0.15, 0.30, 0.45],  // -15% / -30% / -45% tempo de carga
  PERFURACAO: [1, 2, 3],             // 1 / 2 / 3 inimigos perfurados
  DANO: [0.15, 0.30, 0.50],           // +15% / +30% / +50% dano
  CADENCIA: [0.08, 0.15, 0.25],       // -8% / -15% / -25% intervalo entre disparos
  VELOCIDADE: [0.10, 0.20, 0.35],     // +10% / +20% / +35% velocidade projétil
  DISPERSAO: [0.10, 0.20, 0.30],       // -10% / -20% / -30% dispersão
  MUNICAP: [1, 1, 1]                  // +1 projétil por nível (shotgun)
};
// Definições de melhorias por arma e raridade (20 no total, 4 por arma, balanceadas)
// Cada entrada tem: id único, weapon, rarity, name, desc, e apply(weapon) modifica arma
const UPGRADE_DEFS = [
  // NORMAL
  { id:'normal_comum_calibre', weapon:'NORMAL', rarity:'COMUM', name:'Calibre Leve', desc:'+10% velocidade do projétil', apply:(w)=>{
      const base=WEAPON_NORMAL.bulletSpeed;
      w.bulletSpeed = Math.min(w.bulletSpeed * (1+UPGRADE_VALUES.NORMAL_COMUM_SPEED), base*UPGRADE_CAPS.MAX_BULLET_SPEED_FACTOR);
  }},
  { id:'normal_incomum_gatilho', weapon:'NORMAL', rarity:'INCOMUM', name:'Gatilho Polido', desc:'-18% intervalo entre tiros', apply:(w)=>{
      const base=WEAPON_NORMAL.cooldown;
      w.cooldown = Math.max(Math.round(w.cooldown * (1-UPGRADE_VALUES.NORMAL_INCOMUM_COOLDOWN)), Math.round(base*UPGRADE_CAPS.MIN_COOLDOWN_FACTOR));
  }},
  { id:'normal_rara_expansiva', weapon:'NORMAL', rarity:'RARA', name:'Balas Expansivas', desc:'+35% dano e +10% tamanho', apply:(w)=>{
      const base=WEAPON_NORMAL.damage;
      w.damage = Math.min(w.damage * (1+UPGRADE_VALUES.NORMAL_RARA_DANO), base*UPGRADE_CAPS.MAX_DANO_FACTOR);
      w.bulletSize = Math.min(w.bulletSize*1.10, 9);
  }},
  { id:'normal_muito_rara_fantasma', weapon:'NORMAL', rarity:'MUITO_RARA', name:'Tiro Fantasma', desc:'Projétil perfura 1 inimigo', apply:(w)=>{
      w.pierce = true; w.glow='rgba(255,255,255,0.35)';
  }},
  // SHOTGUN
  { id:'shotgun_comum_choke', weapon:'SHOTGUN', rarity:'COMUM', name:'Choke Preciso', desc:'+12% alcance, -8% dispersão', apply:(w)=>{
      const baseR=WEAPON_SHOTGUN.range, baseS=WEAPON_SHOTGUN.spread;
      w.range = Math.min(w.range * (1+UPGRADE_VALUES.SHOTGUN_COMUM_RANGE), baseR*UPGRADE_CAPS.MAX_RANGE_FACTOR);
      w.spread = Math.max(w.spread * (1-UPGRADE_VALUES.SHOTGUN_COMUM_SPREAD_REDUC), baseS*UPGRADE_CAPS.MIN_SPREAD_FACTOR);
  }},
  { id:'shotgun_incomum_cartucho', weapon:'SHOTGUN', rarity:'INCOMUM', name:'Cartucho Duplo', desc:'+1 projétil no disparo', apply:(w)=>{
      w.count = Math.min(w.count + UPGRADE_VALUES.SHOTGUN_INCOMUM_COUNT, UPGRADE_CAPS.MAX_COUNT);
  }},
  { id:'shotgun_rara_impacto', weapon:'SHOTGUN', rarity:'RARA', name:'Impacto Bruto', desc:'+25% dano por pellet', apply:(w)=>{
      const base=WEAPON_SHOTGUN.damage;
      w.damage = Math.min(w.damage * (1+UPGRADE_VALUES.SHOTGUN_RARA_DANO), base*UPGRADE_CAPS.MAX_DANO_FACTOR);
  }},
  { id:'shotgun_muito_rara_tempestade', weapon:'SHOTGUN', rarity:'MUITO_RARA', name:'Tempestade de Chumbo', desc:'+2 projéteis e +10% alcance', apply:(w)=>{
      w.count = Math.min(w.count + UPGRADE_VALUES.SHOTGUN_MUITO_RARA_COUNT, UPGRADE_CAPS.MAX_COUNT);
      const baseR=WEAPON_SHOTGUN.range;
      w.range = Math.min(w.range * (1+UPGRADE_VALUES.SHOTGUN_MUITO_RARA_RANGE), baseR*UPGRADE_CAPS.MAX_RANGE_FACTOR);
  }},
  // RAIO
  { id:'raio_comum_capacitor', weapon:'RAIO', rarity:'COMUM', name:'Capacitor Estável', desc:'-8% intervalo entre tiros', apply:(w)=>{
      const base=WEAPON_RAIO.cooldown;
      w.cooldown = Math.max(Math.round(w.cooldown * (1-UPGRADE_VALUES.RAIO_COMUM_COOLDOWN)), Math.round(base*UPGRADE_CAPS.MIN_COOLDOWN_FACTOR));
  }},
  { id:'raio_incomum_foco', weapon:'RAIO', rarity:'INCOMUM', name:'Foco de Plasma', desc:'+15% velocidade e +10% alcance', apply:(w)=>{
      const baseS=WEAPON_RAIO.bulletSpeed, baseR=WEAPON_RAIO.range;
      w.bulletSpeed = Math.min(w.bulletSpeed * (1+UPGRADE_VALUES.RAIO_INCOMUM_SPEED), baseS*UPGRADE_CAPS.MAX_BULLET_SPEED_FACTOR);
      w.range = Math.min(w.range * (1+UPGRADE_VALUES.RAIO_INCOMUM_RANGE), baseR*UPGRADE_CAPS.MAX_RANGE_FACTOR);
  }},
  { id:'raio_rara_sobrecarga', weapon:'RAIO', rarity:'RARA', name:'Sobrecarga', desc:'+30% dano', apply:(w)=>{
      const base=WEAPON_RAIO.damage;
      w.damage = Math.min(w.damage * (1+UPGRADE_VALUES.RAIO_RARA_DANO), base*UPGRADE_CAPS.MAX_DANO_FACTOR);
  }},
  { id:'raio_muito_rara_cadeia', weapon:'RAIO', rarity:'MUITO_RARA', name:'Cadeia Elétrica', desc:'Atinge +2 alvos próximos (50% dano)', apply:(w)=>{
      w.chain = (w.chain||0) + UPGRADE_VALUES.RAIO_MUITO_RARA_CHAIN;
      // também leve bônus dano para feedback
      if(!w._chainBonus){ w.damage = Math.min(w.damage*1.10, WEAPON_RAIO.damage*UPGRADE_CAPS.MAX_DANO_FACTOR); w._chainBonus=true; }
  }},
  // METRALHADORA
  { id:'metra_comum_dissipador', weapon:'METRALHADORA', rarity:'COMUM', name:'Dissipador Básico', desc:'-10% aquecimento por tiro', apply:(w)=>{
      w._heatPerShot = (w._heatPerShot ?? METRALHADORA_HEAT_PER_SHOT) * (1-UPGRADE_VALUES.METRA_COMUM_HEAT_REDUC);
      w._heatPerShot = Math.max(w._heatPerShot, METRALHADORA_HEAT_PER_SHOT*UPGRADE_CAPS.MIN_HEAT_FACTOR);
  }},
  { id:'metra_incomum_correia', weapon:'METRALHADORA', rarity:'INCOMUM', name:'Correia Reforçada', desc:'+12% velocidade, -5% dispersão', apply:(w)=>{
      const baseS=WEAPON_METRALHADORA.bulletSpeed, baseSp=WEAPON_METRALHADORA.spread;
      w.bulletSpeed = Math.min(w.bulletSpeed * (1+UPGRADE_VALUES.METRA_INCOMUM_SPEED), baseS*UPGRADE_CAPS.MAX_BULLET_SPEED_FACTOR);
      w.spread = Math.max(w.spread * (1-UPGRADE_VALUES.METRA_INCOMUM_SPREAD), baseSp*UPGRADE_CAPS.MIN_SPREAD_FACTOR);
  }},
  { id:'metra_rara_refrigeracao', weapon:'METRALHADORA', rarity:'RARA', name:'Refrigeração Líquida', desc:'-25% aquecimento e +15% resfriamento', apply:(w)=>{
      w._heatPerShot = (w._heatPerShot ?? METRALHADORA_HEAT_PER_SHOT) * (1-UPGRADE_VALUES.METRA_RARA_HEAT_REDUC);
      w._heatPerShot = Math.max(w._heatPerShot, METRALHADORA_HEAT_PER_SHOT*UPGRADE_CAPS.MIN_HEAT_FACTOR);
      w._coolBonus = (w._coolBonus||0) + UPGRADE_VALUES.METRA_RARA_COOL_BONUS;
  }},
  { id:'metra_muito_rara_furia', weapon:'METRALHADORA', rarity:'MUITO_RARA', name:'Modo Fúria', desc:'+20% capacidade térmica e sem penalidade de velocidade', apply:(w)=>{
      w._heatMaxBonus = (w._heatMaxBonus||0) + UPGRADE_VALUES.METRA_MUITO_RARA_HEAT_MAX;
      w._noPenalty = true;
  }},
  // CARREGADA
  { id:'carg_comum_bateria', weapon:'CARREGADA', rarity:'COMUM', name:'Bateria Rápida', desc:'-15% tempo para carga máxima', apply:(w)=>{
      const base=CHARGED_MAX_CHARGE_TIME;
      w._chargeMax = Math.max(Math.round((w._chargeMax ?? base) * (1-UPGRADE_VALUES.CARG_COMUM_CHARGE_REDUC)), UPGRADE_CAPS.MIN_CHARGE_TIME);
  }},
  { id:'carg_incomum_nucleo', weapon:'CARREGADA', rarity:'INCOMUM', name:'Núcleo Estável', desc:'+20% dano máximo carregado', apply:(w)=>{
      w._damageMaxBonus = (w._damageMaxBonus||0) + UPGRADE_VALUES.CARG_INCOMUM_DANO_MAX;
  }},
  { id:'carg_rara_pressao', weapon:'CARREGADA', rarity:'RARA', name:'Pressão Amplificada', desc:'+30% velocidade e +15% alcance', apply:(w)=>{
      const baseS=WEAPON_CARREGADA.bulletSpeed, baseR=WEAPON_CARREGADA.range;
      w.bulletSpeed = Math.min(w.bulletSpeed * (1+UPGRADE_VALUES.CARG_RARA_SPEED), baseS*UPGRADE_CAPS.MAX_BULLET_SPEED_FACTOR);
      w.range = Math.min(w.range * (1+UPGRADE_VALUES.CARG_RARA_RANGE), baseR*UPGRADE_CAPS.MAX_RANGE_FACTOR);
  }},
  { id:'carg_muito_rara_descarga', weapon:'CARREGADA', rarity:'MUITO_RARA', name:'Descarga Perfeita', desc:'Carga máxima: 3 projéteis + perfura', apply:(w)=>{
      w._maxPierce = true;
      w._maxExtra = (w._maxExtra||0) + UPGRADE_VALUES.CARG_MUITO_RARA_EXTRA;
  }},
  // ===== NOVAS ARMAS COMUNS - 3 MELHORIAS CADA (18 total) =====
  // ESPADA
  { id:'espada_comum_fio', weapon:'ESPADA', rarity:'COMUM', name:'Fio Afiado', desc:'+15% dano (leve e pesado)', apply:(w)=>{
      const baseD=WEAPON_ESPADA.damage, baseHD=WEAPON_ESPADA.heavyDamage;
      w.damage = Math.min(w.damage * (1+UPGRADE_VALUES.ESPADA_COMUM_DANO), baseD*UPGRADE_CAPS.MAX_DANO_FACTOR);
      w.heavyDamage = Math.min(w.heavyDamage * (1+UPGRADE_VALUES.ESPADA_COMUM_DANO), baseHD*UPGRADE_CAPS.MAX_DANO_FACTOR);
  }},
  { id:'espada_rara_alcance', weapon:'ESPADA', rarity:'RARA', name:'Alcance Nobre', desc:'+18% alcance + -22% tempo pesado', apply:(w)=>{
      const baseR=WEAPON_ESPADA.range, baseHR=WEAPON_ESPADA.heavyRange, basePrep=WEAPON_ESPADA.heavyPrep;
      w.range = Math.min(w.range * (1+UPGRADE_VALUES.ESPADA_RARA_ALCANCE), baseR*UPGRADE_CAPS.MAX_RANGE_FACTOR);
      w.heavyRange = Math.min(w.heavyRange * (1+UPGRADE_VALUES.ESPADA_RARA_ALCANCE), baseHR*UPGRADE_CAPS.MAX_RANGE_FACTOR);
      w.heavyPrep = Math.max(Math.round(w.heavyPrep * (1-UPGRADE_VALUES.ESPADA_RARA_PREP_REDUC)), 260);
  }},
  { id:'espada_muito_rara_fantasma', weapon:'ESPADA', rarity:'MUITO_RARA', name:'Lâmina Espectral', desc:'+18% ângulo e pesado perfura', apply:(w)=>{
      w.meleeAngle = Math.min(w.meleeAngle * (1+UPGRADE_VALUES.ESPADA_MUITO_RARA_ANGLE), 145);
      w.heavyAngle = Math.min(w.heavyAngle * (1+UPGRADE_VALUES.ESPADA_MUITO_RARA_ANGLE), 165);
      w.pierce = Math.max(w.pierce||0, 1);
  }},
  // ===== NOVOS UPGRADES ESPADA - Corte à distância e Guardião Ágil (requisito) =====
  { id:'espada_incomum_corte_vento', weapon:'ESPADA', rarity:'INCOMUM', name:'Corte de Vento', desc:'Pesado carregado dispara corte à frente', apply:(w)=>{
      w._swordWave = true;
      // valores balanceáveis já em UPGRADE_VALUES (range/speed/dmg)
      w._swordWaveRange = UPGRADE_VALUES.ESPADA_INCOMUM_WAVE_RANGE;
      w._swordWaveSpeed = UPGRADE_VALUES.ESPADA_INCOMUM_WAVE_SPEED;
      w._swordWaveFactor = UPGRADE_VALUES.ESPADA_INCOMUM_WAVE_DMG_FACTOR;
      w._swordWaveSize = UPGRADE_VALUES.ESPADA_INCOMUM_WAVE_SIZE;
  }},
  { id:'espada_rara_guardiao_agil', weapon:'ESPADA', rarity:'RARA', name:'Postura do Guardião', desc:'Ao carregar ganha escudo (1 hit) e +32% vel.', apply:(w)=>{
      w._swordGuardian = true;
      w._guardianSpeed = UPGRADE_VALUES.ESPADA_RARA_GUARDIAO_SPEED;
      w._guardianShieldMs = UPGRADE_VALUES.ESPADA_RARA_GUARDIAO_SHIELD_MS;
  }},
  // LUVA
  { id:'luva_comum_propulsor', weapon:'LUVA', rarity:'COMUM', name:'Propulsor Leve', desc:'+14% velocidade ida', apply:(w)=>{
      const base=WEAPON_LUVA.bulletSpeed;
      w.bulletSpeed = Math.min(w.bulletSpeed * (1+UPGRADE_VALUES.LUVA_COMUM_SPEED), base*UPGRADE_CAPS.MAX_BULLET_SPEED_FACTOR);
  }},
  { id:'luva_rara_alcance', weapon:'LUVA', rarity:'RARA', name:'Braço Alongado', desc:'+18% alcance', apply:(w)=>{
      const base=WEAPON_LUVA.range;
      const basePunch=WEAPON_LUVA.punchRange||base;
      const baseRocket=WEAPON_LUVA.rocketRange||base;
      w.range = Math.min(w.range * (1+UPGRADE_VALUES.LUVA_RARA_RANGE), base*UPGRADE_CAPS.MAX_RANGE_FACTOR);
      w.punchRange = Math.min((w.punchRange||basePunch) * (1+UPGRADE_VALUES.LUVA_RARA_RANGE), basePunch*UPGRADE_CAPS.MAX_RANGE_FACTOR);
      w.rocketRange = Math.min((w.rocketRange||baseRocket) * (1+UPGRADE_VALUES.LUVA_RARA_RANGE), baseRocket*UPGRADE_CAPS.MAX_RANGE_FACTOR);
  }},
  { id:'luva_muito_rara_perfurante', weapon:'LUVA', rarity:'MUITO_RARA', name:'Punho Perfurante', desc:'Perfura 1 + retorno 18% mais rápido', apply:(w)=>{
      w.pierce = Math.max(w.pierce||0, 1);
      w._returnSpeedBonus = (w._returnSpeedBonus||0) + UPGRADE_VALUES.LUVA_MUITO_RARA_SPEED_RETURN;
  }},
  // BASTÃO JG - melhorias exclusivas (4 raridades)
  { id:'bastao_comum_fio', weapon:'BASTAO', rarity:'COMUM', name:'Bastão Afiado', desc:'+14% dano melee e arremesso', apply:(w)=>{
      const base=WEAPON_BASTAO.damage, baseHD=WEAPON_BASTAO.throwDamage||WEAPON_BASTAO.heavyDamage;
      w.damage = Math.min(w.damage * (1+UPGRADE_VALUES.BASTAO_COMUM_DANO), base*UPGRADE_CAPS.MAX_DANO_FACTOR);
      w.throwDamage = Math.min((w.throwDamage||baseHD) * (1+UPGRADE_VALUES.BASTAO_COMUM_DANO), baseHD*UPGRADE_CAPS.MAX_DANO_FACTOR);
      w.heavyDamage = w.throwDamage;
  }},
  { id:'bastao_comum_alcance', weapon:'BASTAO', rarity:'COMUM', name:'Alcance Estendido', desc:'+12% alcance melee', apply:(w)=>{
      const base=WEAPON_BASTAO.range;
      w.range = Math.min(w.range * (1+UPGRADE_VALUES.BASTAO_COMUM_RANGE), base*UPGRADE_CAPS.MAX_RANGE_FACTOR);
  }},
  { id:'bastao_incomum_velocidade', weapon:'BASTAO', rarity:'INCOMUM', name:'Giro Rápido', desc:'+18% vel. arremesso e +16% alcance arremesso', apply:(w)=>{
      const baseS=WEAPON_BASTAO.throwSpeed;
      const baseR=WEAPON_BASTAO.throwRange;
      w.throwSpeed = Math.min(w.throwSpeed * (1+UPGRADE_VALUES.BASTAO_INCOMUM_SPEED), baseS*UPGRADE_CAPS.MAX_BULLET_SPEED_FACTOR);
      w.throwRange = Math.min(w.throwRange * (1+UPGRADE_VALUES.BASTAO_INCOMUM_RANGE_THROW), baseR*UPGRADE_CAPS.MAX_RANGE_FACTOR);
      w.heavyRange = w.throwRange;
  }},
  { id:'bastao_rara_impacto', weapon:'BASTAO', rarity:'RARA', name:'Impacto Giratório', desc:'+28% dano arremesso e -18% cooldown', apply:(w)=>{
      const baseD=WEAPON_BASTAO.throwDamage||WEAPON_BASTAO.heavyDamage;
      const baseC=WEAPON_BASTAO.cooldown;
      w.throwDamage = Math.min((w.throwDamage||baseD) * (1+UPGRADE_VALUES.BASTAO_RARA_DANO_THROW), baseD*UPGRADE_CAPS.MAX_DANO_FACTOR);
      w.heavyDamage = w.throwDamage;
      w.cooldown = Math.max(Math.round(w.cooldown * (1-UPGRADE_VALUES.BASTAO_RARA_COOLDOWN)), Math.round(baseC*UPGRADE_CAPS.MIN_COOLDOWN_FACTOR));
      w.heavyCooldown = Math.max(Math.round((w.heavyCooldown||520) * (1-UPGRADE_VALUES.BASTAO_RARA_COOLDOWN*0.5)), 380);
  }},
  { id:'bastao_muito_rara_furacao', weapon:'BASTAO', rarity:'MUITO_RARA', name:'Furacão Amarelo', desc:'+32% dano e arremesso perfura +22% retorno', apply:(w)=>{
      const baseD=WEAPON_BASTAO.damage;
      w.damage = Math.min(w.damage * (1+UPGRADE_VALUES.BASTAO_MUITO_RARA_DANO), baseD*UPGRADE_CAPS.MAX_DANO_FACTOR);
      w.throwDamage = Math.min((w.throwDamage||w.heavyDamage) * (1+UPGRADE_VALUES.BASTAO_MUITO_RARA_DANO), baseD*UPGRADE_CAPS.MAX_DANO_FACTOR);
      w.heavyDamage = w.throwDamage;
      w.pierce = Math.max(w.pierce||0, 1);
      w._returnBonus = (w._returnBonus||0) + UPGRADE_VALUES.BASTAO_MUITO_RARA_RETURN;
  }},

  // ===== NOVO SISTEMA COMUM/INCOMUM COM NÍVEIS (até 3) - modular =====
  // Alcance aumentado - todas as armas
  { id:'alcance_comum', weapon:'ALL', compatible:['NORMAL','SHOTGUN','RAIO','METRALHADORA','CARREGADA','BAZUCA','ESPADA','LUVA','MOTOSSERRA','BASTAO'], rarity:'COMUM', name:'Mira Alongada', desc:'Alcance +15% / +30% / +50%', maxLevel:3, levelValues: UPGRADE_LEVEL_VALUES.ALCANCE, apply:(w, level)=>{
      const v = UPGRADE_LEVEL_VALUES.ALCANCE[level-1] || 0;
      const baseMap={NORMAL:WEAPON_NORMAL,SHOTGUN:WEAPON_SHOTGUN,RAIO:WEAPON_RAIO,METRALHADORA:WEAPON_METRALHADORA,CARREGADA:WEAPON_CARREGADA,BAZUCA:WEAPON_BAZUCA,ESPADA:WEAPON_ESPADA,LUVA:WEAPON_LUVA,MOTOSSERRA:WEAPON_MOTOSSERRA,BASTAO:WEAPON_BASTAO,RAIO_MATEMATICO:WEAPON_RAIO_MATEMATICO};
      const base = baseMap[w.name] ? baseMap[w.name].range : (w.range||60);
      // aplica nível atual (não cumulativo, sobrescreve)
      const factor = 1 + v;
      w.range = Math.min(base * factor, base * UPGRADE_CAPS.MAX_RANGE_FACTOR);
  }},
  // Recarga rápida - todas
  { id:'recarga_comum', weapon:'ALL', compatible:['NORMAL','SHOTGUN','RAIO','METRALHADORA','CARREGADA','BAZUCA','ESPADA','LUVA','MOTOSSERRA','BASTAO'], rarity:'COMUM', name:'Recarga Ágil', desc:'Recarga -10% / -20% / -30%', maxLevel:3, levelValues: UPGRADE_LEVEL_VALUES.RECARGA, apply:(w, level)=>{
      const v = UPGRADE_LEVEL_VALUES.RECARGA[level-1] || 0;
      const baseMap={NORMAL:WEAPON_NORMAL,SHOTGUN:WEAPON_SHOTGUN,RAIO:WEAPON_RAIO,METRALHADORA:WEAPON_METRALHADORA,CARREGADA:WEAPON_CARREGADA,BAZUCA:WEAPON_BAZUCA,ESPADA:WEAPON_ESPADA,LUVA:WEAPON_LUVA,MOTOSSERRA:WEAPON_MOTOSSERRA,BASTAO:WEAPON_BASTAO,RAIO_MATEMATICO:WEAPON_RAIO_MATEMATICO};
      const base = baseMap[w.name] ? baseMap[w.name].cooldown : (w.cooldown||600);
      w.cooldown = Math.max(Math.round(base * (1 - v)), Math.round(base * UPGRADE_CAPS.MIN_COOLDOWN_FACTOR));
  }},
  // Cadência aumentada - todas (similar recarga, mas para cadência)
  { id:'cadencia_comum', weapon:'ALL', compatible:['NORMAL','SHOTGUN','RAIO','METRALHADORA','CARREGADA','BAZUCA','ESPADA','LUVA','MOTOSSERRA','BASTAO'], rarity:'COMUM', name:'Gatilho Veloz', desc:'Cadência -8% / -15% / -25%', maxLevel:3, levelValues: UPGRADE_LEVEL_VALUES.CADENCIA, apply:(w, level)=>{
      const v = UPGRADE_LEVEL_VALUES.CADENCIA[level-1] || 0;
      const baseMap={NORMAL:WEAPON_NORMAL,SHOTGUN:WEAPON_SHOTGUN,RAIO:WEAPON_RAIO,METRALHADORA:WEAPON_METRALHADORA,CARREGADA:WEAPON_CARREGADA,BAZUCA:WEAPON_BAZUCA,ESPADA:WEAPON_ESPADA,LUVA:WEAPON_LUVA,MOTOSSERRA:WEAPON_MOTOSSERRA,BASTAO:WEAPON_BASTAO,RAIO_MATEMATICO:WEAPON_RAIO_MATEMATICO};
      const base = baseMap[w.name] ? baseMap[w.name].cooldown : (w.cooldown||600);
      // cadência é mesmo que recarga mas com valores menores
      w.cooldown = Math.max(Math.round(base * (1 - v)), Math.round(base * UPGRADE_CAPS.MIN_COOLDOWN_FACTOR));
  }},
  // Dano aumentado - todas
  { id:'dano_comum', weapon:'ALL', compatible:['NORMAL','SHOTGUN','RAIO','METRALHADORA','CARREGADA','BAZUCA','ESPADA','LUVA','MOTOSSERRA','BASTAO'], rarity:'COMUM', name:'Munição Potente', desc:'Dano +15% / +30% / +50%', maxLevel:3, levelValues: UPGRADE_LEVEL_VALUES.DANO, apply:(w, level)=>{
      const v = UPGRADE_LEVEL_VALUES.DANO[level-1] || 0;
      const baseMap={NORMAL:WEAPON_NORMAL,SHOTGUN:WEAPON_SHOTGUN,RAIO:WEAPON_RAIO,METRALHADORA:WEAPON_METRALHADORA,CARREGADA:WEAPON_CARREGADA,BAZUCA:WEAPON_BAZUCA,ESPADA:WEAPON_ESPADA,LUVA:WEAPON_LUVA,MOTOSSERRA:WEAPON_MOTOSSERRA,BASTAO:WEAPON_BASTAO,RAIO_MATEMATICO:WEAPON_RAIO_MATEMATICO};
      const base = baseMap[w.name] ? baseMap[w.name].damage : (w.damage||1.5);
      w.damage = Math.min(base * (1 + v), base * UPGRADE_CAPS.MAX_DANO_FACTOR);
  }},
  // Projétil mais rápido - todas
  { id:'velocidade_comum', weapon:'ALL', compatible:['NORMAL','SHOTGUN','RAIO','METRALHADORA','CARREGADA','BAZUCA','ESPADA','LUVA','MOTOSSERRA','BASTAO'], rarity:'COMUM', name:'Propulsor Leve', desc:'Vel. projétil +10% / +20% / +35%', maxLevel:3, levelValues: UPGRADE_LEVEL_VALUES.VELOCIDADE, apply:(w, level)=>{
      const v = UPGRADE_LEVEL_VALUES.VELOCIDADE[level-1] || 0;
      const baseMap={NORMAL:WEAPON_NORMAL,SHOTGUN:WEAPON_SHOTGUN,RAIO:WEAPON_RAIO,METRALHADORA:WEAPON_METRALHADORA,CARREGADA:WEAPON_CARREGADA,BAZUCA:WEAPON_BAZUCA,ESPADA:WEAPON_ESPADA,LUVA:WEAPON_LUVA,MOTOSSERRA:WEAPON_MOTOSSERRA,BASTAO:WEAPON_BASTAO,RAIO_MATEMATICO:WEAPON_RAIO_MATEMATICO};
      const base = baseMap[w.name] ? baseMap[w.name].bulletSpeed : (w.bulletSpeed||8);
      w.bulletSpeed = Math.min(base * (1 + v), base * UPGRADE_CAPS.MAX_BULLET_SPEED_FACTOR);
  }},
  // Shotgun - Alcance (comum)
  { id:'shotgun_alcance_comum', weapon:'SHOTGUN', compatible:['SHOTGUN'], rarity:'COMUM', name:'Cano Longo', desc:'Alcance Shotgun +15% / +30% / +50%', maxLevel:3, levelValues: UPGRADE_LEVEL_VALUES.ALCANCE, apply:(w, level)=>{
      const v = UPGRADE_LEVEL_VALUES.ALCANCE[level-1] || 0;
      w.range = Math.min(WEAPON_SHOTGUN.range * (1 + v), WEAPON_SHOTGUN.range * UPGRADE_CAPS.MAX_RANGE_FACTOR);
  }},
  // Shotgun - Dispersão reduzida
  { id:'shotgun_dispersao_comum', weapon:'SHOTGUN', compatible:['SHOTGUN'], rarity:'COMUM', name:'Choke Fino', desc:'Dispersão -10% / -20% / -30%', maxLevel:3, levelValues: UPGRADE_LEVEL_VALUES.DISPERSAO, apply:(w, level)=>{
      const v = UPGRADE_LEVEL_VALUES.DISPERSAO[level-1] || 0;
      w.spread = Math.max(WEAPON_SHOTGUN.spread * (1 - v), WEAPON_SHOTGUN.spread * UPGRADE_CAPS.MIN_SPREAD_FACTOR);
  }},
  // Shotgun - Munição extra (capacidade)
  { id:'shotgun_municao_comum', weapon:'SHOTGUN', compatible:['SHOTGUN'], rarity:'COMUM', name:'Tambor Estendido', desc:'Munição +1 / +2 / +3 projéteis', maxLevel:3, levelValues: UPGRADE_LEVEL_VALUES.MUNICAP, apply:(w, level)=>{
      // nível determina total extra
      const extra = level; // +1 por nível
      w.count = Math.min(WEAPON_SHOTGUN.count + extra, UPGRADE_CAPS.MAX_COUNT);
  }},
  // Shotgun - Recarga rápida específica
  { id:'shotgun_recarga_comum', weapon:'SHOTGUN', compatible:['SHOTGUN'], rarity:'COMUM', name:'Recarga Shotgun', desc:'Recarga -10% / -20% / -30%', maxLevel:3, levelValues: UPGRADE_LEVEL_VALUES.RECARGA, apply:(w, level)=>{
      const v = UPGRADE_LEVEL_VALUES.RECARGA[level-1] || 0;
      w.cooldown = Math.max(Math.round(WEAPON_SHOTGUN.cooldown * (1 - v)), Math.round(WEAPON_SHOTGUN.cooldown * UPGRADE_CAPS.MIN_COOLDOWN_FACTOR));
  }},
  // Carregamento rápido - CARREGADA
  { id:'carregamento_rapido_comum', weapon:'CARREGADA', compatible:['CARREGADA'], rarity:'COMUM', name:'Carga Rápida', desc:'Carregamento -15% / -30% / -45%', maxLevel:3, levelValues: UPGRADE_LEVEL_VALUES.CARREGAMENTO, apply:(w, level)=>{
      const v = UPGRADE_LEVEL_VALUES.CARREGAMENTO[level-1] || 0;
      const base = CHARGED_MAX_CHARGE_TIME;
      w._chargeMax = Math.max(Math.round(base * (1 - v)), UPGRADE_CAPS.MIN_CHARGE_TIME);
  }},
  // Dano carregado - CARREGADA
  { id:'dano_carregado_incomum', weapon:'CARREGADA', compatible:['CARREGADA'], rarity:'INCOMUM', name:'Núcleo Supercarregado', desc:'Dano carregado +15% / +30% / +50%', maxLevel:3, levelValues: UPGRADE_LEVEL_VALUES.DANO, apply:(w, level)=>{
      const v = UPGRADE_LEVEL_VALUES.DANO[level-1] || 0;
      w._damageMaxBonus = v;
  }},
  // Pistola - Munição Perfurante (INCOMUM) 1/2/3 inimigos
  { id:'perfurante_incomum', weapon:'NORMAL', compatible:['NORMAL'], rarity:'INCOMUM', name:'Perfuração', desc:'Perfura 1 / 2 / 3 inimigos', maxLevel:3, levelValues: UPGRADE_LEVEL_VALUES.PERFURACAO, apply:(w, level)=>{
      const v = UPGRADE_LEVEL_VALUES.PERFURACAO[level-1] || 1;
      w.pierceCount = v; // usado para lógica pierce
      w.pierce = true;
      w.glow = 'rgba(255,255,255,0.35)';
      // cap de perfuração
      if(w.pierceCount > UPGRADE_CAPS.MAX_PERFURACAO) w.pierceCount = UPGRADE_CAPS.MAX_PERFURACAO;
  }},
  // ===== MOTOSSERRA (incomum curta) - 4 raridades balanceadas, arma base INCOMUM =====
  { id:'motosserra_comum_dentes', weapon:'MOTOSSERRA', rarity:'COMUM', name:'Dentes de Aço', desc:'+18% dano da motosserra', apply:(w)=>{
      const base=WEAPON_MOTOSSERRA.damage;
      w.damage = Math.min(w.damage * (1+UPGRADE_VALUES.MOTOSSERRA_COMUM_DANO), base*UPGRADE_CAPS.MAX_DANO_FACTOR);
      w.heavyDamage = w.damage; // compat
  }},
  { id:'motosserra_incomum_motor', weapon:'MOTOSSERRA', rarity:'INCOMUM', name:'Motor Turbinado', desc:'-18% intervalo da motosserra (ticks mais rápidos)', apply:(w)=>{
      const base=WEAPON_MOTOSSERRA.tickInterval || 135;
      const cur = w.tickInterval || base;
      w.tickInterval = Math.max(70, Math.round(cur * (1-UPGRADE_VALUES.MOTOSSERRA_INCOMUM_COOLDOWN)));
      // também acelera giro visual
      w._spinBonus = (w._spinBonus||0)+0.12;
  }},
  { id:'motosserra_rara_corrente', weapon:'MOTOSSERRA', rarity:'RARA', name:'Corrente Longa', desc:'+22% alcance e +20% ângulo (área maior)', apply:(w)=>{
      const baseR=WEAPON_MOTOSSERRA.range;
      const baseA=WEAPON_MOTOSSERRA.meleeAngle;
      w.range = Math.min(w.range * (1+UPGRADE_VALUES.MOTOSSERRA_RARA_ALCANCE), baseR*UPGRADE_CAPS.MAX_RANGE_FACTOR);
      w.meleeAngle = Math.min(w.meleeAngle * (1+UPGRADE_VALUES.MOTOSSERRA_RARA_ANGLE), 175);
      // área retangular também cresce
      const baseW=WEAPON_MOTOSSERRA.areaW||58, baseH=WEAPON_MOTOSSERRA.areaH||46, baseOff=WEAPON_MOTOSSERRA.offset||34;
      w.areaW = Math.min((w.areaW||baseW) * (1+UPGRADE_VALUES.MOTOSSERRA_RARA_ALCANCE), baseW*1.6);
      w.areaH = Math.min((w.areaH||baseH) * (1+UPGRADE_VALUES.MOTOSSERRA_RARA_ANGLE*0.5), baseH*1.6);
      w.offset = Math.min((w.offset||baseOff) * (1+UPGRADE_VALUES.MOTOSSERRA_RARA_ALCANCE*0.6), baseOff*1.4);
  }},
  { id:'motosserra_muito_rara_pochita', weapon:'MOTOSSERRA', rarity:'MUITO_RARA', name:'Pochita - Chainsaw Man', desc:'Referência Chainsaw Man • 2 motosserras extras à direita e esquerda do personagem (estilo Denji) • +55% dano • +18% alcance • +38% ângulo', apply:(w)=>{
      // Pochita Chainsaw Man - Denji: 2 motosserras laterais à direita/esquerda do personagem + central, referência visual Chainsaw Man
      w.hasPochita = true;
      w.hasPochitaSideSaws = true; // ativa serras laterais no visual do personagem (direita/esquerda)
      w.sawCount = 3; // central +2 laterais na arma (lógico 3, visual total 5 com laterais do personagem)
      const baseD=WEAPON_MOTOSSERRA.damage;
      w.damage = Math.min(w.damage * (1+UPGRADE_VALUES.MOTOSSERRA_MUITO_RARA_POCHITA_DANO), baseD*UPGRADE_CAPS.MAX_DANO_FACTOR);
      const baseR=WEAPON_MOTOSSERRA.range;
      w.range = Math.min(w.range * (1+UPGRADE_VALUES.MOTOSSERRA_MUITO_RARA_POCHITA_RANGE), baseR*UPGRADE_CAPS.MAX_RANGE_FACTOR);
      w.meleeAngle = Math.min(w.meleeAngle * (1+UPGRADE_VALUES.MOTOSSERRA_MUITO_RARA_POCHITA_ANGLE), 185);
      const baseW=WEAPON_MOTOSSERRA.areaW||58, baseH=WEAPON_MOTOSSERRA.areaH||46, baseOff=WEAPON_MOTOSSERRA.offset||34;
      w.areaW = Math.min((w.areaW||baseW) * (1+UPGRADE_VALUES.MOTOSSERRA_MUITO_RARA_POCHITA_RANGE), baseW*1.7);
      w.areaH = Math.min((w.areaH||baseH) * (1+UPGRADE_VALUES.MOTOSSERRA_MUITO_RARA_POCHITA_RANGE), baseH*1.7);
      w.offset = Math.min((w.offset||baseOff) * (1+UPGRADE_VALUES.MOTOSSERRA_MUITO_RARA_POCHITA_RANGE*0.7), baseOff*1.5);
      w._pochitaChargeBonus = 6; // +6 carga por tick com Pochita
      w.pochitaGlow='rgba(255,180,60,0.38)';
  }},
  // ===== NOVAS MELHORIAS GERAIS (balanceadas, todas as armas) =====
  { id:'geral_comum_poder', weapon:'ALL', compatible:['NORMAL','SHOTGUN','RAIO','METRALHADORA','CARREGADA','BAZUCA','ESPADA','LUVA','MOTOSSERRA','BASTAO'], rarity:'COMUM', name:'Núcleo de Poder', desc:'+12% dano (todas)', maxLevel:3, levelValues: UPGRADE_LEVEL_VALUES.DANO, apply:(w, level)=>{
      const v=[0.12,0.24,0.36][level-1]||0;
      const baseMap={NORMAL:WEAPON_NORMAL,SHOTGUN:WEAPON_SHOTGUN,RAIO:WEAPON_RAIO,METRALHADORA:WEAPON_METRALHADORA,CARREGADA:WEAPON_CARREGADA,BAZUCA:WEAPON_BAZUCA,ESPADA:WEAPON_ESPADA,LUVA:WEAPON_LUVA,MOTOSSERRA:WEAPON_MOTOSSERRA,BASTAO:WEAPON_BASTAO,RAIO_MATEMATICO:WEAPON_RAIO_MATEMATICO};
      const base=baseMap[w.name]?baseMap[w.name].damage:(w.damage||1);
      w.damage=Math.min(base*(1+v), base*UPGRADE_CAPS.MAX_DANO_FACTOR);
  }},
  { id:'geral_comum_alcance', weapon:'ALL', compatible:['NORMAL','SHOTGUN','RAIO','METRALHADORA','CARREGADA','BAZUCA','ESPADA','LUVA','MOTOSSERRA','BASTAO'], rarity:'COMUM', name:'Mira Estabilizadora', desc:'+15% alcance (todas)', maxLevel:3, levelValues: UPGRADE_LEVEL_VALUES.ALCANCE, apply:(w, level)=>{
      const v=UPGRADE_LEVEL_VALUES.ALCANCE[level-1]||0;
      const baseMap={NORMAL:WEAPON_NORMAL,SHOTGUN:WEAPON_SHOTGUN,RAIO:WEAPON_RAIO,METRALHADORA:WEAPON_METRALHADORA,CARREGADA:WEAPON_CARREGADA,BAZUCA:WEAPON_BAZUCA,ESPADA:WEAPON_ESPADA,LUVA:WEAPON_LUVA,MOTOSSERRA:WEAPON_MOTOSSERRA,BASTAO:WEAPON_BASTAO,RAIO_MATEMATICO:WEAPON_RAIO_MATEMATICO};
      const base=baseMap[w.name]?baseMap[w.name].range:(w.range||60);
      w.range=Math.min(base*(1+v), base*UPGRADE_CAPS.MAX_RANGE_FACTOR);
  }},
  { id:'geral_incomum_recarga', weapon:'ALL', compatible:['NORMAL','SHOTGUN','RAIO','METRALHADORA','CARREGADA','BAZUCA','ESPADA','LUVA','MOTOSSERRA','BASTAO'], rarity:'INCOMUM', name:'Recarga Quântica', desc:'-15% recarga (todas)', maxLevel:3, levelValues: [0.15,0.28,0.40], apply:(w, level)=>{
      const v=[0.15,0.28,0.40][level-1]||0;
      const baseMap={NORMAL:WEAPON_NORMAL,SHOTGUN:WEAPON_SHOTGUN,RAIO:WEAPON_RAIO,METRALHADORA:WEAPON_METRALHADORA,CARREGADA:WEAPON_CARREGADA,BAZUCA:WEAPON_BAZUCA,ESPADA:WEAPON_ESPADA,LUVA:WEAPON_LUVA,MOTOSSERRA:WEAPON_MOTOSSERRA,BASTAO:WEAPON_BASTAO,RAIO_MATEMATICO:WEAPON_RAIO_MATEMATICO};
      const base=baseMap[w.name]?baseMap[w.name].cooldown:(w.cooldown||600);
      w.cooldown=Math.max(Math.round(base*(1-v)), Math.round(base*UPGRADE_CAPS.MIN_COOLDOWN_FACTOR));
  }},
  { id:'geral_rara_critico', weapon:'ALL', compatible:['NORMAL','SHOTGUN','RAIO','METRALHADORA','CARREGADA','BAZUCA','ESPADA','LUVA','MOTOSSERRA','BASTAO'], rarity:'RARA', name:'Sobrecarga Prismática', desc:'+28% dano raro (todas)', apply:(w)=>{
      const baseMap={NORMAL:WEAPON_NORMAL,SHOTGUN:WEAPON_SHOTGUN,RAIO:WEAPON_RAIO,METRALHADORA:WEAPON_METRALHADORA,CARREGADA:WEAPON_CARREGADA,BAZUCA:WEAPON_BAZUCA,ESPADA:WEAPON_ESPADA,LUVA:WEAPON_LUVA,MOTOSSERRA:WEAPON_MOTOSSERRA,BASTAO:WEAPON_BASTAO,RAIO_MATEMATICO:WEAPON_RAIO_MATEMATICO};
      const base=baseMap[w.name]?baseMap[w.name].damage:(w.damage||1);
      w.damage=Math.min(w.damage*1.28, base*UPGRADE_CAPS.MAX_DANO_FACTOR);
  }},
  { id:'geral_muito_rara_perfurante', weapon:'ALL', compatible:['NORMAL','SHOTGUN','RAIO','METRALHADORA','CARREGADA','ESPADA','LUVA','MOTOSSERRA'], rarity:'MUITO_RARA', name:'Perfuração Digital', desc:'Perfura +1 inimigo (todas)', apply:(w)=>{
      w.pierce = true;
      w.pierceCount = Math.min((w.pierceCount||0)+1, UPGRADE_CAPS.MAX_PERFURACAO);
      w.glow='rgba(0,255,136,0.32)';
  }},
  // ===== BASTÃO - novo raro adicional (personagem único) =====
  { id:'bastao_rara_eco', weapon:'BASTAO', rarity:'RARA', name:'Eco Giratório', desc:'Arremesso deixa eco que causa 50% dano', apply:(w)=>{
      w._ecoEnabled=true;
      w._ecoDamageFactor=0.50;
  }},
  // ===== ESPADA - novas melhorias únicas =====
  { id:'espada_incomum_vamp', weapon:'ESPADA', rarity:'INCOMUM', name:'Sede de Código', desc:'+14% dano e cura 0.5 ao abater', apply:(w)=>{
      const base=WEAPON_ESPADA.damage;
      w.damage=Math.min(w.damage*1.14, base*UPGRADE_CAPS.MAX_DANO_FACTOR);
      w._vampHeal=0.5;
  }},
  { id:'espada_rara_tempestade', weapon:'ESPADA', rarity:'RARA', name:'Tempestade de Lâminas', desc:'Pesado: +1 onda extra lateral', apply:(w)=>{
      w._stormExtraWave=true;
  }},
  // ===== LUVA - novas =====
  { id:'luva_incomum_turbo', weapon:'LUVA', rarity:'INCOMUM', name:'Punho Turbo', desc:'+20% velocidade ida/volta', apply:(w)=>{
      const base=WEAPON_LUVA.bulletSpeed;
      w.bulletSpeed=Math.min(w.bulletSpeed*1.20, base*UPGRADE_CAPS.MAX_BULLET_SPEED_FACTOR);
      w._returnSpeedBonus=(w._returnSpeedBonus||0)+0.18;
  }},
  { id:'luva_rara_sismico', weapon:'LUVA', rarity:'RARA', name:'Impacto Sísmico', desc:'Ao retornar causa onda de choque', apply:(w)=>{
      w._shockOnReturn=true;
      w._shockRadius=58;
      w._shockDamage=1.2;
  }},
  // Especial incomum: Circuito Ágil - reduz recarga de itens especiais
  { id:'especial_incomum_recarga', weapon:'ALL', compatible:['ALL'], rarity:'INCOMUM', name:'Circuito Ágil', desc:'-10% recarga itens especiais', maxLevel:3, levelValues:[0.10,0.20,0.30], apply:(w, level)=>{ /* efeito via Player.addUpgrade: reduz cooldown de E */ }},
  // ===== DEV - LAZER CODIFICADO (Brimstone) - Sistema modular de upgrades =====
  // Cada upgrade altera características distintas do Lazer Codificado. Modular: basta add novo objeto aqui.
  { id:'raio_mat_comum_carga', weapon:'RAIO_MATEMATICO', rarity:'COMUM', name:'Cálculo Acelerado', desc:'-15% tempo de carregamento', apply:(w)=>{
      const base=RAIO_MATEMATICO_CHARGE_TIME;
      const cur = w._rayChargeMax || base;
      w._rayChargeMax = Math.max(Math.round(cur * (1-RAIO_MAT_CHARGE_REDUC)), 500);
  }},
  { id:'raio_mat_incomum_dano', weapon:'RAIO_MATEMATICO', rarity:'INCOMUM', name:'Núcleo Potente', desc:'+20% dano do raio principal', apply:(w)=>{
      const base=WEAPON_RAIO_MATEMATICO.damage;
      w.damage = Math.min(w.damage * (1+RAIO_MAT_DANO_BONUS), base*UPGRADE_CAPS.MAX_DANO_FACTOR);
  }},
  { id:'raio_mat_rara_alcance', weapon:'RAIO_MATEMATICO', rarity:'RARA', name:'Lente Ampliada', desc:'+15% alcance e +12% tamanho', apply:(w)=>{
      const baseR=WEAPON_RAIO_MATEMATICO.range, baseS=WEAPON_RAIO_MATEMATICO.bulletSize;
      w.range = Math.min(w.range * (1+RAIO_MAT_RANGE_BONUS), baseR*UPGRADE_CAPS.MAX_RANGE_FACTOR);
      w.bulletSize = Math.min(w.bulletSize * (1+0.12), baseS*1.8);
      w._raySizeBonus = (w._raySizeBonus||0)+0.12;
  }},
  { id:'raio_mat_rara_velocidade', weapon:'RAIO_MATEMATICO', rarity:'RARA', name:'Propulsor Quântico', desc:'+18% velocidade do projétil', apply:(w)=>{
      const base=WEAPON_RAIO_MATEMATICO.bulletSpeed;
      w.bulletSpeed = Math.min(w.bulletSpeed * (1+RAIO_MAT_SPEED_BONUS), base*UPGRADE_CAPS.MAX_BULLET_SPEED_FACTOR);
  }},
  { id:'raio_mat_muito_rara_pierce', weapon:'RAIO_MATEMATICO', rarity:'MUITO_RARA', name:'Raio Perfurante', desc:'Perfura inimigos (pierce)', apply:(w)=>{
      w.pierce = true;
      w.pierceCount = 999;
      w.glow = 'rgba(184,255,251,0.55)';
  }},
  // Sobremesa - COMUM - mini raios a cada 10% (requisito balanceado, não OP)
  // Dispara mini raio durante carregamento, dano reduzido, mais rápido, não bloqueia carga.
  { id:'sobremesa', weapon:'RAIO_MATEMATICO', compatible:['RAIO_MATEMATICO'], rarity:'COMUM', name:'Sobremesa', desc:'A cada 10% de carga dispara mini raio (dano -58%, +38% vel)', maxLevel:1, apply:(w)=>{
      w._sobremesa = true;
      // Não altera dano/speed base, apenas ativa flag - lógica de disparo fica no Game loop
  }},
];
// Mapa rápido id -> def e weapon -> lista
const UPGRADE_MAP = new Map(UPGRADE_DEFS.map(u=>[u.id,u]));
function getUpgradesForWeapon(weaponName){
  return UPGRADE_DEFS.filter(u=>u.weapon===weaponName);
}

// Compatibilidade: BULLET_* antigos agora derivados da arma atual
const BULLET_SPEED = WEAPON_NORMAL.bulletSpeed;
const BULLET_SIZE = WEAPON_NORMAL.bulletSize;
const BULLET_DAMAGE = WEAPON_NORMAL.damage;
const BULLET_COOLDOWN = WEAPON_NORMAL.cooldown; // para referência externa
const BULLET_RANGE = WEAPON_NORMAL.range;

const ENEMY_SIZE = 28;
const ENEMY_SPEED = 1.35;
const ENEMY_HP = 3;
const ENEMY_DAMAGE_COOLDOWN = 900;

// --- Fugitivo ---
const FUGITIVE_SIZE = 26;
const FUGITIVE_HP = 2;
const FUGITIVE_SPEED = 2.45;
const FUGITIVE_DETECT_RADIUS = 230;  // quando detecta jogador
const FUGITIVE_KEEP_DISTANCE = 185;  // tenta manter esta distância
const FUGITIVE_SHOOT_COOLDOWN = 1700; // intervalo grande entre disparos
const FUGITIVE_BULLET_SPEED = 2.9;   // disparo lento
const FUGITIVE_BULLET_RANGE = 420;
const FUGITIVE_BULLET_SIZE = 7;

// --- Itens ---
const ITEM_SIZE_SMALL_HEART = 18;
const ITEM_SIZE_LARGE_HEART = 22;
const ITEM_SIZE_SHOTGUN = 22;
const ITEM_SIZE_RAIO = 22;
const ITEM_SIZE_FLAME = 20;
// Tamanhos para novas armas comuns (removidas MARTELO/LANCA/ARCO/MACHADO)
const ITEM_SIZE_ESPADA = 20;
const ITEM_SIZE_LUVA = 22;
const ITEM_SIZE_MOTOSSERRA = 22;
const ITEM_SIZE_BASTAO = 20;
// --- Coração Cibernético (Bone Heart - recipiente cinza) ---
// Agora funciona como Bone Heart: ocupa 1 recipiente (2 HP) de vida, pode ser perdido.
// Visual/nome mantidos, apenas lógica alterada para Bone Heart.
const ITEM_SIZE_CYBER_HEART = 22;      // tamanho no chão (preservado)
const CYBER_HEART_HP_AMOUNT = 2;       // 1 coração cibernético = 1 recipiente = 2 HP (Bone Heart)
const CYBER_HEART_MAX_CYBER = 8;       // máximo de HP em Bone Hearts (4 recipientes = 8 HP) - limite de recipientes cinza
const CYBER_HEART_MAX_HP = 10;         // compatibilidade (legado) - não usado, limite real é base 6 + 8 = 14
const CYBER_HEART_SPAWN_CHANCE = 0.06; // 6% por sala normal, 10.8% em treasure
// Bone Heart: base fixa de containers vermelhos
const BONE_HEART_RED_CAPACITY = 6;     // 3 corações vermelhos base (inicial)
const BONE_HEART_MAX_CONTAINERS = CYBER_HEART_MAX_CYBER / 2; // 4 recipientes cinza máximo

// --- Rastro de Fogo (passivo raro) configurações fáceis de alterar ---
const fireDamage = 1;        // dano por tick
const fireDuration = 3200;   // ms que o fogo permanece no chão
const fireTickRate = 420;    // ms entre ticks de dano (evita dano por frame)
const fireRadius = 22;       // raio de colisão do fogo

// --- Kamikaze (explosão) ---
const KAMIKAZE_SIZE = 26;
const KAMIKAZE_HP = 2;
const KAMIKAZE_SPEED = 2.9;
const KAMIKAZE_DETECT_RADIUS = 260;
const explosionRadius = 92;      // raio da explosão
const explosionDamage = 2;       // dano da explosão (1 coração)
const explosionDuration = 360;   // ms duração do círculo visual

// --- Invocador ---
const SUMMONER_SIZE = 28;
const SUMMONER_HP = 4;
const SUMMONER_SPEED = 1.15;
const summonCooldown = 3200;          // ms entre invocações
const maxSummonedEnemies = 3;         // limite simultâneo por invocador
const summonedEnemyHealth = 1;        // vida reduzida dos invocados
const summonedEnemySpeed = 1.6;

// --- Espinhos ---
const SPIKE_SIZE = 28;
const spikeDamage = 1;        // meio coração
const spikeCooldown = 900;    // invulnerabilidade após dano de espinho

// --- Sala Rara ---
const rareRoomChance = 0.22;  // 22% de chance de gerar uma RareItemRoom por andar (configurável)
const rareItems = ['flame_trail', 'raio', 'metralhadora', 'double_shot', 'power_star']; // expansível: basta adicionar novos tipos - power_star incluído Fase 5

// --- Sala de Festa (Horda) — pode aparecer em qualquer fase ---
const PARTY_HORDE_CHANCE = 0.20; // 20% por andar (pode aparecer em qualquer fase 1-5)
const PARTY_HORDE_WAVES = 3;      // 3 ondas
const PARTY_HORDE_WAVE_DELAY = 1600; // ms entre ondas (reduzido de 3200 para evitar sala vazia fechada parecer bug)
const PARTY_HORDE_ENEMIES_MIN = 4; // por onda (mín)
const PARTY_HORDE_ENEMIES_MAX = 6; // por onda (máx)
// Cores festa (tema vibrante)
const PARTY_COLORS = ['#ff3b30','#ffcc00','#00e5ff','#4ade80','#c084fc','#ff6b9d','#ffd23f'];

// --- Fase 4: Miniboss (configurável) ---
const MINIBOSS_ROOM_CHANCE = 0.35; // 35% de chance de gerar sala miniboss na Fase 4 (fácil alterar)
const MINIBOSS_SIZE = 42;
const MINIBOSS_HP = 28; // vida alta
const MINIBOSS_DAMAGE = 2; // 1 coração por projétil/investida
const MINIBOSS_CROSS_COOLDOWN = 2100;
const MINIBOSS_X_COOLDOWN = 2100;
const MINIBOSS_DASH_PREP = 700; // preparação antes da investida
const MINIBOSS_DASH_SPEED = 7.5;
const MINIBOSS_DASH_DURATION = 320;
const MINIBOSS_PHASE2_HP = 0.20; // 20% entra em fase 2
const MINIBOSS_SUMMON_COOLDOWN = 3800;
const MINIBOSS_MAX_SUMMONS = 3;
const MINIBOSS_BULLET_SPEED = 4.2;
const MINIBOSS_BULLET_SIZE = 6;

// --- Novo Inimigo: Investida ---
const DASH_ENEMY_SIZE = 28;
const DASH_ENEMY_HP = 3;
const DASH_ENEMY_SPEED = 1.1;
const DASH_ENEMY_DETECT_RADIUS = 200;
const DASH_ENEMY_CHARGE_TIME = 700; // ms carregando
const DASH_ENEMY_DASH_SPEED = 7.0;
const DASH_ENEMY_DASH_DURATION = 260;
const DASH_ENEMY_STUN_DURATION = 1800; // atordoado após bater parede
const DASH_ENEMY_DAMAGE = 1;

// ===================== X-SHOOTER (FASE 2+ - ATIRA EM X) =====================
const XSHOOTER_SIZE = 26;
const XSHOOTER_HP = 3;
const XSHOOTER_SPEED = 1.65;
const XSHOOTER_SHOOT_COOLDOWN = 1650;
const XSHOOTER_BULLET_SPEED = 3.4;
const XSHOOTER_BULLET_RANGE = 380;
const XSHOOTER_BULLET_SIZE = 6;
const XSHOOTER_BULLET_DAMAGE = 1;

// ===================== VARIAÇÕES DE INIMIGOS (VIDA / DANO) =====================
// Sistema leve e configurável: ao spawnar, inimigos comuns têm chance de virar variação.
// - Tanque: +120% vida, maior, mais lento, cor azulada, ícone 🛡️
// - Brutal: +100% dano (contato/tiro/explosão), levemente mais rápido, cor avermelhada, ícone ⚔️
// - Elite: ambos (tank+brute) + bônus extra, aura roxa/dourada, ícone ★
// Chance escala com o andar (fase mais alta = mais variações) e é reduzida para invocados.
const VARIATION_TANK_BASE_CHANCE = 0.09;   // 9% base fase 1
const VARIATION_BRUTE_BASE_CHANCE = 0.08;  // 8% base fase 1
const VARIATION_ELITE_BASE_CHANCE = 0.03;  // 3% base fase 1 (rara)
const VARIATION_FLOOR_BONUS = 0.018;       // +1.8% por andar (fase 5 ≈ +7.2%)
const VARIATION_TANK_HP_MULT = 2.2;        // vida 2.2x (ex: Chaser 3 -> 7)
const VARIATION_TANK_SIZE_MULT = 1.20;     // 20% maior
const VARIATION_TANK_SPEED_PENALTY = 0.88; // 12% mais lento
const VARIATION_BRUTE_DMG_MULT = 2;        // dano 2x (1 -> 2, 2 -> 4)
const VARIATION_BRUTE_SPEED_BONUS = 1.14;  // 14% mais rápido
const VARIATION_BRUTE_BULLET_SPEED_BONUS = 1.18;
const VARIATION_ELITE_HP_BONUS = 1.35;     // elite = tank*1.35 ( ~3x vida total)
const VARIATION_ELITE_SIZE_BONUS = 1.08;   // extra 8% em cima do tank
const VARIATION_SUMMONED_REDUCTION = 0.45; // invocados têm 45% da chance normal

function getVariationChanceForFloor(base, floor){
  const f = Math.max(1, floor|0);
  return Math.min(0.28, base + (f-1)*VARIATION_FLOOR_BONUS);
}
function rollEnemyVariation(rng, floor){
  const tankCh = getVariationChanceForFloor(VARIATION_TANK_BASE_CHANCE, floor);
  const bruteCh = getVariationChanceForFloor(VARIATION_BRUTE_BASE_CHANCE, floor);
  const eliteCh = getVariationChanceForFloor(VARIATION_ELITE_BASE_CHANCE, floor);
  const r = rng();
  if(r < eliteCh) return 'elite';
  if(r < eliteCh + tankCh) return 'tank';
  if(r < eliteCh + tankCh + bruteCh) return 'brute';
  return null;
}
function applyEnemyVariation(enemy, rng, floor){
  if(!enemy || enemy.variation) return false;
  if(enemy.type==='miniboss' || enemy.type==='stair_boss') return false;
  // invocados têm chance reduzida
  let effectiveRng = rng;
  if(enemy.isSummoned){
    if(rng() > VARIATION_SUMMONED_REDUCTION) return false;
    // usa rng original para sorteio mas já passou no filtro
  }
  const variation = rollEnemyVariation(effectiveRng, floor||1);
  if(!variation) return false;
  enemy.variation = variation;
  const isTank = variation==='tank' || variation==='elite';
  const isBrute = variation==='brute' || variation==='elite';
  // --- VIDA / TAMANHO ---
  if(isTank){
    let hpMult = VARIATION_TANK_HP_MULT;
    if(variation==='elite') hpMult *= VARIATION_ELITE_HP_BONUS;
    enemy.maxHp = Math.ceil(enemy.maxHp * hpMult);
    enemy.hp = enemy.maxHp;
    enemy.w = Math.round(enemy.w * VARIATION_TANK_SIZE_MULT * (variation==='elite'?VARIATION_ELITE_SIZE_BONUS:1));
    enemy.h = Math.round(enemy.h * VARIATION_TANK_SIZE_MULT * (variation==='elite'?VARIATION_ELITE_SIZE_BONUS:1));
    // mais lento
    enemy.speed *= VARIATION_TANK_SPEED_PENALTY;
    if(enemy._baseSpeed) enemy._baseSpeed *= VARIATION_TANK_SPEED_PENALTY;
  }
  // --- DANO ---
  if(isBrute){
    // dano de contato padrão
    enemy.collisionDamage = Math.ceil((enemy.collisionDamage||1) * VARIATION_BRUTE_DMG_MULT);
    // dano específico por tipo
    if(enemy.type==='fugitive'){
      enemy.bulletDamage = Math.ceil((enemy.bulletDamage||1) * VARIATION_BRUTE_DMG_MULT);
      enemy.bulletSpeed = (enemy.bulletSpeed||FUGITIVE_BULLET_SPEED) * VARIATION_BRUTE_BULLET_SPEED_BONUS;
    }
    if(enemy.type==='kamikaze'){
      enemy.explosionDamage = Math.ceil((enemy.explosionDamage||explosionDamage) * VARIATION_BRUTE_DMG_MULT);
      enemy.explosionRadius = Math.round((enemy.explosionRadius||explosionRadius) * 1.18);
    }
    if(enemy.type==='dash'){
      // já via collisionDamage, mas garante
      enemy.dashDamage = Math.ceil((enemy.dashDamage||DASH_ENEMY_DAMAGE) * VARIATION_BRUTE_DMG_MULT);
    }
    if(enemy.type==='summoner'){
      // brute summoner invoca um pouco mais rápido (pressão)
      if(enemy.summonTimer) enemy.summonTimer *= 0.85;
    }
    // velocidade extra para brute
    enemy.speed *= VARIATION_BRUTE_SPEED_BONUS;
    if(enemy._baseSpeed) enemy._baseSpeed *= VARIATION_BRUTE_SPEED_BONUS;
  }
  if(variation==='elite'){
    // elite já tem ambos, mas dá leve bônus extra de velocidade compensando tank
    enemy.speed *= 1.06;
    if(enemy._baseSpeed) enemy._baseSpeed *= 1.06;
  }
  // marca para HUD/debug
  enemy.isVariationApplied = true;
  return true;
}
function getVariationVisual(variation){
  if(variation==='tank') return { color:'#60a5fa', glow:'rgba(96,165,250,0.22)', icon:'🛡️', label:'TANQUE' };
  if(variation==='brute') return { color:'#ff3b30', glow:'rgba(255,59,48,0.22)', icon:'⚔️', label:'BRUTAL' };
  if(variation==='elite') return { color:'#c084fc', glow:'rgba(192,132,252,0.28)', icon:'★', label:'ELITE' };
  return null;
}
function drawVariationAura(ctx, enemy, bob){
  if(!enemy.variation) return;
  const vis=getVariationVisual(enemy.variation);
  const pulse=0.5+Math.sin(enemy.anim*0.013)*0.32;
  ctx.fillStyle=vis.glow;
  ctx.beginPath(); ctx.arc(enemy.x, enemy.y+bob, enemy.w*0.96+pulse*5,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle=vis.color;
  ctx.lineWidth=enemy.variation==='elite'?2:1.4;
  ctx.beginPath(); ctx.arc(enemy.x, enemy.y+bob, enemy.w*0.88+pulse*2,0,Math.PI*2); ctx.stroke();
  if(enemy.variation==='elite'){
    ctx.strokeStyle='rgba(255,215,0,0.42)';
    ctx.lineWidth=1;
    ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.arc(enemy.x, enemy.y+bob, enemy.w*1.02+pulse*3,0,Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
  }
}
function drawVariationIcon(ctx, enemy, x, y, bob){
  if(!enemy.variation) return;
  const vis=getVariationVisual(enemy.variation);
  ctx.fillStyle=vis.color;
  ctx.font=enemy.variation==='elite'?'7px monospace':'6px monospace';
  ctx.textAlign='center';
  ctx.fillText(vis.icon, enemy.x, y-10+bob);
  ctx.textAlign='left';
  if(enemy.variation!=='elite'){
    ctx.fillStyle='rgba(255,255,255,0.88)';
    ctx.font='4px monospace'; ctx.textAlign='center';
    ctx.fillText(vis.label, enemy.x, y-16+bob); ctx.textAlign='left';
  } else {
    ctx.fillStyle='rgba(255,215,0,0.92)';
    ctx.font='5px monospace'; ctx.textAlign='center';
    ctx.fillText('ELITE', enemy.x, y-16+bob); ctx.textAlign='left';
  }
}

// --- Nova Arma Muito Rara: BAZUCA ---
const WEAPON_BAZUCA = {
  name: 'BAZUCA',
  cooldown: 900, // baixa cadência (0.9s)
  range: 500,
  damage: 5, // dano centro explosão
  count: 1,
  spread: 0,
  bulletSpeed: 4.6, // lento visível
  color: '#ff3b30',
  bulletSize: 7,
  pierce: false,
  isBazuca: true,
  explosionRadius: 96,
  explosionDamage: 4, // dano área total
  falloff: true // dano diminui com distância
};

// ===================== NOVAS ARMAS COMUNS - Design Divertido e Balanceado =====================
// Cada arma comum tem estilo único, alcance/velocidade/dano distintos, mas DPS similar (~3.5-4.4) para não haver superior clara.
// Todas são fáceis de entender, visuais marcantes e integradas ao universo.
// --- ESPADA: curta, rápida, com golpe pesado carregado - MELHORADA v6 ---
// Mais útil: alcance/dano/cooldown buffados, combo 3 golpes, lunge leve, onda base no pesado (upgrade amplia)
const WEAPON_ESPADA = {
  name: 'ESPADA',
  cooldown: 285, // leve mais rápido (era 340) - mais ágil
  heavyCooldown: 540, // pesado mais rápido (era 680)
  range: 72, // alcance buffado (era 64) +12%
  heavyRange: 90, // pesado buffado (era 76)
  damage: 1.9, // leve buffado (era 1.6)
  heavyDamage: 3.8, // pesado buffado (era 3.2)
  heavyPrep: 320, // carrega mais rápido (era 420) -24%
  meleeAngle: 120, // cone leve mais largo (era 110)
  heavyAngle: 150, // cone pesado mais largo (era 135)
  bulletSpeed: 0,
  color: '#e8e8e8',
  glow: 'rgba(220,220,230,0.22)',
  isMelee: true,
  isSword: true,
  // Novos: combo e lunge
  comboWindow: 680, // ms para manter combo
  comboBonus: 0.28, // +28% no 3º golpe
  lungeDist: 14, // dash curto no leve
  // Onda base no pesado (sem upgrade já tem onda pequena, upgrade amplia)
  baseWaveRange: 190,
  baseWaveSpeed: 8.2,
  baseWaveSize: 7,
  baseWaveFactor: 0.52 // dano onda = heavyDamage * factor
};
// --- LUVA DE BOXE: socos retos curtos + foguete carregado (REWORK) ---
// Socos retos de curto alcance com cadência que aumenta segurando. Barra enche e no máximo lança foguetes.
const WEAPON_LUVA = {
  name: 'LUVA',
  // socos retos curtos
  cooldown: 320, // base entre socos (diminui com carga)
  minCooldown: 110, // limite máximo de velocidade
  range: 58, // alcance curto reto
  punchRange: 58,
  punchDamage: 1.4,
  punchAngle: 38,
  // foguete especial (quando barra cheia)
  damage: 4.2, // dano foguete ida
  returnDamage: 1.8,
  bulletSpeed: 11.5,
  rocketSpeed: 11.5,
  rocketRange: 420,
  rocketSize: 10,
  bulletSize: 10,
  color: '#ff3b30',
  glow: 'rgba(255,60,60,0.28)',
  isFist: true,
  isLuva: true,
  isDual: true,
  dualOffset: 10,
  pierce: false,
  chargeMax: 100
};
const LUVA_CHARGE_MAX = 100;
const LUVA_CHARGE_RATE = 34; // por segundo segurando ataque
const LUVA_CHARGE_DECAY = 22; // por segundo soltando
const LUVA_PUNCH_BASE = 320;
const LUVA_PUNCH_MIN = 110;
const LUVA_ROCKET_DAMAGE = 4.2;
const LUVA_ROCKET_SPEED = 11.5;
const LUVA_ROCKET_RANGE = 420;
const LUVA_ROCKET_SIZE = 10;
// --- VISUAL NOVO: socos mola (jab) - duas luvas vão e voltam, foguete lança quando barra cheia ---
const LUVA_JAB_SPEED = 13.5;      // velocidade mola ida (px/frame) - rápido e responsivo
const LUVA_JAB_RANGE = 68;        // alcance curto mola (ligeiramente maior que punchRange 58 para visual)
const LUVA_JAB_SIZE = 9.5;
const LUVA_JAB_DAMAGE = 1.4;
const LUVA_JAB_RETURN_DAMAGE = 0.9;
const LUVA_JAB_RETURN_FACTOR = 1.38; // retorno mais rápido para sensação elástica
const LUVA_SPRING_SEGMENTS = 7;   // segmentos da mola visual
const LUVA_SPRING_WIDTH = 4.2;    // amplitude zigue-zague

// ===================== ARMA EXCLUSIVA JG - BASTÃO =====================
// Bastão arremessável de JG: ataque corpo a corpo rápido + arremesso carregado que gira e retorna
const WEAPON_BASTAO = {
  name: 'BASTAO',
  cooldown: 310, // leve rápido
  heavyCooldown: 520, // arremesso
  range: 68, // melee curto-médio
  heavyRange: 340, // alcance arremesso (mesmo que throwRange)
  damage: 2.0, // dano melee
  heavyDamage: 2.8, // dano arremesso por hit
  meleeAngle: 118,
  heavyAngle: 360, // arremesso é direcional mas gira
  bulletSpeed: 0,
  color: '#facc15',
  glow: 'rgba(250,204,21,0.24)',
  isMelee: true,
  isBastao: true,
  isBastaoWeapon: true,
  // parametros arremesso
  throwSpeed: 9.2,
  throwRange: 340,
  throwSize: 9,
  throwReturnSpeed: 10.5
};
// Constantes balanceáveis JG
const JG_SPEED_WITH_BASTAO = 4.45; // muito rápido com bastão (PLAYER_SPEED 3.0 base + bonus)
const JG_SPEED_WITHOUT_BASTAO = 2.05; // mais lento sem bastão
const JG_BASTAO_CHARGE_TIME = 520; // ms para carregar arremesso (segurar)
const JG_BASTAO_RETURN_SPEED = 10.5;
const JG_BASTAO_DAMAGE = 2.8;
const JG_BASTAO_SIZE = 9;

// ===================== NOVA ARMA INCOMUM - MOTOSSERRA (ÁREA RETA AFINADA + BARRA CURA) =====================
// AFINADA: ataque curto RETO em retângulo AFIADO na frente, altamente preciso e responsivo
// - Quadrado afinado: mais estreito (32px altura) para exigir mira, mais longo (62px) para alcance preciso
// - Dano por tick levemente maior e intervalo mais rápido (110ms = 9 ticks/s) - sensação cortante contínua
// - Tremor refinado (menos caótico) e recuo sutil para feedback sem perder controle
// - Centro do retângulo causa +25% dano crítico (precisão recompensada)
// - Barra: 6 hits = cura, preenche só com acertos precisos
const WEAPON_MOTOSSERRA = {
  name: 'MOTOSSERRA',
  cooldown: 0, // sem cooldown - dano por tick
  tickInterval: 110, // AFINADO: 110ms (9.1 ticks/s) - mais responsivo e afiado
  range: 52,
  damage: 1.45, // AFINADO: 1.45 por tick (0.72♥) - corte preciso mais forte
  meleeAngle: 32,
  areaW: 62, // AFINADO: 62px comprido (mais alcance reto)
  areaH: 32, // AFINADO: 32px estreito (precisa mirar, linha afiada)
  offset: 38, // AFINADO: 38px frente (ligeiramente mais à frente para não atingir atrás)
  bulletSpeed: 0,
  color: '#ff1e0a',
  glow: 'rgba(255,30,10,0.46)',
  isMelee: true,
  isMotosserra: true,
  isMotosserraWeapon: true,
  isMotosserraHold: true,
  pierce: 99,
  bleed: 0.7,
  bleedTicks: 2,
  knockback: 3.5, // AFINADO: recuo menor e mais preciso
  sawCount: 1
};
// Constantes balanceáveis Motosserra & Pochita + ÁREA AFINADA
const MOTOSSERRA_DAMAGE_BASE = 1.45;
const MOTOSSERRA_RANGE_BASE = 52;
const MOTOSSERRA_ANGLE_BASE = 32;
const MOTOSSERRA_AREA_W = 62; // AFINADO: mais comprido afiado
const MOTOSSERRA_AREA_H = 32; // AFINADO: mais estreito preciso (linha)
const MOTOSSERRA_OFFSET = 38; // AFINADO: mais à frente, não pega atrás
const MOTOSSERRA_TICK_INTERVAL = 110; // AFINADO: mais rápido e responsivo (9.1/s)
const MOTOSSERRA_CHARGE_PER_HIT = 16; // AFINADO: 7 hits = 100 (precisa mirar, mais preciso)
const MOTOSSERRA_CHARGE_PER_TICK_EMPTY = 2; // AFINADO: só 2 no vazio (precisa acertar)
const MOTOSSERRA_CHARGE_MAX = 100;
const MOTOSSERRA_HEAL_AMOUNT = 2; // 1 coração
const MOTOSSERRA_CHARGE_DECAY_DELAY = 1500; // AFINADO: decai um pouco mais rápido (1.5s)
const MOTOSSERRA_CHARGE_DECAY_RATE = 22; // AFINADO: decai 22/s
const POCHITA_EXTRA_SAWS = 2;
const POCHITA_DAMAGE_BONUS = 0.48; // +48% tick (1.45 -> 2.14)
const POCHITA_RANGE_BONUS = 0.22; // +22% área (62→75, 32→39) - ainda afiado mas maior
const POCHITA_ANGLE_BONUS = 0.55;
const MOTOSSERRA_SAW_SPIN_SPEED = 0.72; // AFINADO: ainda mais rápida
const MOTOSSERRA_HIT_PARTICLES = 6; // AFINADO: ligeiramente menos poluído, mais nítido
const MOTOSSERRA_VIBRATE_AMP = 1.6; // AFINADO: tremor refinado menos caótico
const MOTOSSERRA_RECOIL_AMP = 1.0; // AFINADO: recuo sutil preciso

// ===================== DEV - LAZER CODIFICADO (ex-RAIO MATEMÁTICO) - Brimstone Isaac =====================
// Arma exclusiva do Dev: agora é LAZER CODIFICADO estilo Brimstone de The Binding of Isaac.
// Mecânica: segure para carregar 100% (1050ms) e solte para disparar um RAIO RETANGULAR reto com ondulações.
// Visual: retângulo grosso contínuo (não projétil pontual), bordas onduladas suaves, paleta azul/ciano Brimstone.
// Dano: moderado (2.2 = 1.1 corações) para equilíbrio - não one-shot, mas consistente e perfurante.
// Modular: constantes editáveis para balanceamento. Sistema de upgrades compatível com WEAPON_UPGRADES.
const WEAPON_RAIO_MATEMATICO = {
  name: 'RAIO_MATEMATICO',
  displayName: 'LAZER CODIFICADO',
  cooldown: 560,      // intervalo após disparo - Brimstone lento mas potente
  range: 400,         // alcance reduzido (pedido: diminuir um pouco) - ainda longo mas não atravessa sala toda
  damage: 2.2,        // dano moderado (1.1 corações) - pedido: moderado
  count: 1,
  spread: 0,
  bulletSpeed: 11.0,  // mantido para compatibilidade mas não usado (beam é instantâneo/hitscan)
  color: '#b8fffb',   // núcleo ciano claro Brimstone azul
  bulletSize: 9,      // largura base do retângulo beam (será usado como beamWidth)
  beamWidth: 20,      // largura retângulo Brimstone (retinho)
  beamDuration: 420,  // ms que o feixe fica visível
  pierce: true,       // Brimstone perfura tudo
  isCharged: true,         // reutiliza detecção de carga mas com gate 100%
  isRayMatematico: true,   // flag exclusiva - agora representa LAZER CODIFICADO
  isLazerCodificado: true, // alias para clareza
  trailColor: 'rgba(26,127,191,0.45)',
  glow: 'rgba(10,58,110,0.55)'
};
// Constantes balanceáveis do Lazer Codificado (todas editáveis) - renomeado de RAIO_MATEMATICO mas mantém compat.
const RAIO_MATEMATICO_CHARGE_TIME = 1050;      // ms para atingir 100% (segurar 1.05s) - Brimstone charge
const RAIO_MATEMATICO_MIN_CHARGE_TIME = 0;     // não há carga mínima: precisa 100% exato
const RAIO_MATEMATICO_SPEED_FACTOR = 1.0;      // modificado por upgrades
// Constantes do FEIXE Brimstone
const LAZER_BEAM_WIDTH = 20;           // largura retângulo base (px)
const LAZER_BEAM_DURATION = 420;       // ms visível (Brimstone flash)
const LAZER_BEAM_WAVE_AMP = 3.2;       // amplitude ondulação nas bordas (px)
const LAZER_BEAM_WAVE_FREQ = 0.52;     // frequência espacial ondulação (ciclos ao longo do feixe)
const LAZER_BEAM_WAVE_SPEED = 0.009;   // velocidade animação ondulação
const LAZER_BEAM_DAMAGE = 2.2;         // dano moderado por beam (usa WEAPON_RAIO_MATEMATICO.damage se existir)
// Mini raio Sobremesa - valores balanceáveis (mantido para upgrade opcional, agora mini = pequeno projétil laranja)
const RAIO_MATEMATICO_MINI_DAMAGE_FACTOR = 0.42;   // 42% do dano principal (~0.92)
const RAIO_MATEMATICO_MINI_SPEED_FACTOR = 1.38;    // 38% mais rápido que principal
const RAIO_MATEMATICO_MINI_SIZE = 3.8;
const RAIO_MATEMATICO_MINI_RANGE_FACTOR = 0.72;    // 72% do alcance principal
const RAIO_MATEMATICO_MINI_COLOR = '#ffd8a8';      // laranja claro para diferenciar
const RAIO_MATEMATICO_MINI_GLOW = 'rgba(255,220,160,0.45)';
// Upgrade values para Raio Matemático (compatível com sistema UPGRADE_VALUES)
const RAIO_MAT_DANO_BONUS = 0.20;            // +20% dano por nível raro
const RAIO_MAT_CHARGE_REDUC = 0.15;           // -15% tempo carga por nível comum
const RAIO_MAT_RANGE_BONUS = 0.15;            // +15% alcance por nível
const RAIO_MAT_SIZE_BONUS = 0.18;             // +18% tamanho por nível
const RAIO_MAT_SPEED_BONUS = 0.18;            // +18% velocidade projétil

// ===================== OLI - SISTEMA XADREZ (constantes balanceáveis) =====================
const OLI_COOLDOWN = 10000; // 10s cooldown para invocação (reusa sistema SpecialItem)
const OLI_MAX_PIECES = 4; // limite simultâneo de peças maiores (Torre/Bispo/Rainha/Rei)
const OLI_TORRE_HP = 6; const OLI_TORRE_DAMAGE = 2.2; const OLI_TORRE_SPEED = 1.9; const OLI_TORRE_CHARGE_SPEED = 6.5; const OLI_TORRE_LIFE = 15000; const OLI_TORRE_DETECT_X = 28; // mesma coluna = |dx| < 28
const OLI_BISPO_HP = 5; const OLI_BISPO_DAMAGE = 1.6; const OLI_BISPO_SPEED = 3.0; const OLI_BISPO_LIFE = 12000;
const OLI_RAINHA_HP = 6; const OLI_RAINHA_DAMAGE = 1.4; const OLI_RAINHA_SPEED = 2.1; const OLI_RAINHA_SHOOT_COOLDOWN = 750; const OLI_RAINHA_BULLET_SPEED = 7.5; const OLI_RAINHA_RANGE = 420; const OLI_RAINHA_LIFE = 14000;
const OLI_REI_HP = 9; const OLI_REI_DAMAGE = 0; const OLI_REI_SPEED = 1.4; const OLI_REI_LIFE = 13000;
const OLI_PAWN_HP = 5; const OLI_PAWN_DAMAGE = 2.1; const OLI_PAWN_SPEED = 3.15; const OLI_PAWN_LIFE = 13000; const OLI_PAWN_COUNT_ON_KING = 3;
const OLI_PAWN_PROMOTE_KILLS = 2; // após 2 abates promove
const OLI_PAWN_STUN_CHANCE = 0.18; // 18% chance de atordoar 320ms
const OLI_PAWN_SHIELD_REDUCTION = 0.28; // 28% redução de dano recebido

// ===================== SISTEMA MODULAR DE PERSONAGENS =====================
// Arquitetura: CHARACTER_DEFS centraliza atributos de cada personagem de forma declarativa.
// - Player armazena characterId e estado exclusivo (ex: hasBastao, bastaoProjectile).
// - Game gerencia seleção e aplica personagem via applyCharacterToPlayer() sem duplicar lógica.
// - Para adicionar novo personagem: adicione entrada em CHARACTER_DEFS e implemente hooks
//   opcionais em CHARACTER_HOOKS (update, canEquipWeapon, getSpeed, onEquip). Não precisa
//   reescrever Player/Game. Suporta novos atributos/arma/habilidade de forma isolada.
const CHARACTER_DEFS = {
  jg: {
    id: 'jg',
    displayName: 'JG',
    icon: '🏏',
    color: '#facc15',
    bg: 'rgba(250,204,21,0.16)',
    border: 'rgba(250,204,21,0.45)',
    maxHp: 4, // 2 corações *2
    boneHearts: 0,
    starterWeapon: 'BASTAO',
    starterSpecial: null,
    allowedWeapons: ['BASTAO'], // lock exclusivo - evita duplicação e mantém identidade
    exclusive: 'bastao',
    description: '2 ♥ • Casaco cinza, camisa amarela (muda ao arremessar), calça azul-escuro, sem boné • Bastão giratório dano ida/volta e reflete tiros • Rápido com bastão, lento sem',
    speedWithBastao: JG_SPEED_WITH_BASTAO,
    speedWithoutBastao: JG_SPEED_WITHOUT_BASTAO,
    chargeTime: JG_BASTAO_CHARGE_TIME
  },
  kinight: {
    id: 'kinight',
    displayName: 'Kinight',
    icon: '🛡️',
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.14)',
    border: 'rgba(96,165,250,0.44)',
    maxHp: 6, // 3 corações base vermelhos
    boneHearts: 1, // +1 cibernético = +2 HP => total 8 (8/2=4 corações na HUD)
    starterWeapon: 'ESPADA',
    starterSpecial: null,
    allowedWeapons: ['ESPADA'], // só espada, não pode equipar outras
    exclusive: 'cavaleiro',
    description: '3 ♥ + 1 ♥ Cibernético • Só Espada • Tanque leal • Um pouco mais lento (armadura pesada)'
  },
  jl: {
    id: 'jl',
    displayName: 'JL',
    icon: '67',
    color: '#ff6b9d',
    bg: 'rgba(255,107,157,0.16)',
    border: 'rgba(255,107,157,0.48)',
    maxHp: 6, // 3 corações
    boneHearts: 0,
    starterWeapon: 'NORMAL', // pistola farmar
    starterSpecial: 'farmar_aura',
    allowedWeapons: null, // pode usar qualquer arma - versatilidade farmar
    exclusive: 'farmar_aura',
    description: '3 ♥ • Hoodie 67 Neon Rosa • Pistola + Farmar Aura [E] 12s • Área 155 raio 3.8s queima+empurra • Um pouco mais lento • Street farmar'
  },
  neutro: {
    id: 'neutro',
    displayName: 'Neutro',
    icon: '👤',
    color: '#d1d5db',
    bg: 'rgba(209,213,219,0.16)',
    border: 'rgba(209,213,219,0.42)',
    maxHp: 6, // 3 corações padrão
    boneHearts: 0,
    starterWeapon: 'NORMAL', // pistola padrão
    starterSpecial: null, // sem habilidade exclusiva - puro equilíbrio
    allowedWeapons: null, // pode usar qualquer arma
    exclusive: 'neutro',
    description: '3 ♥ • Pistola padrão • Sem exclusivos - equilíbrio puro, ideal para iniciantes'
  },
  oli: {
    id: 'oli',
    displayName: 'Oli',
    icon: '♞',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.16)',
    border: 'rgba(167,139,250,0.45)',
    maxHp: 6, // 3 corações
    boneHearts: 0,
    starterWeapon: 'NORMAL', // pistola para defesa enquanto peças atacam
    starterSpecial: 'oli_xadrez',
    allowedWeapons: null, // pode usar qualquer arma, foco é invocação
    exclusive: 'oli_xadrez',
    description: '3 ♥ • Pistola + Xadrez ♞ - Invoca Torre ♜, Bispo ♝, Rainha ♛ e Rei ♚ em ciclo'
  },
  ash: {
    id: 'ash',
    displayName: 'Ash',
    icon: '🪚',
    color: '#ff3b30',
    bg: 'rgba(255,59,48,0.16)',
    border: 'rgba(255,59,48,0.45)',
    maxHp: 6, // 3 corações
    boneHearts: 0,
    starterWeapon: 'MOTOSSERRA',
    starterSpecial: null, // não pode usar itens especiais
    allowedWeapons: null, // pode pegar qualquer arma como secundária, motosserra fixa
    exclusive: 'motosserra',
    description: '3 ♥ • Motosserra fixa (curto reto + cura) • Sem especiais • [E] troca arma • Pode carregar +1 arma'
  },
  dev: {
    id: 'dev',
    displayName: 'Dev',
    icon: '👓',
    color: '#e8f0ff',
    bg: 'rgba(232,240,255,0.14)',
    border: 'rgba(180,210,255,0.45)',
    maxHp: 6, // 3 corações
    boneHearts: 0,
    starterWeapon: 'RAIO_MATEMATICO',
    starterSpecial: null, // sem especial inicial - foco no Lazer Codificado
    allowedWeapons: null, // pode usar qualquer arma mas foco é Lazer Codificado
    exclusive: 'raio_matematico',
    description: '3 ♥ • Óculos e jaleco branco • Programador/Cientista • Lazer Codificado: Brimstone retângulo reto com ondulações • Dano moderado (2.2) • Segure 100% e solte'
  }
};
const CHARACTER_IDS = Object.keys(CHARACTER_DEFS);
function getCharacterDef(id){
  return CHARACTER_DEFS[id] || null;
}
function listCharacters(){
  return CHARACTER_IDS.map(id=> CHARACTER_DEFS[id]);
}
// Hooks modulares por personagem (extensível). Cada hook pode implementar update, canEquip, etc.
// Para novo personagem, adicione chave com mesmo id e implemente métodos necessários.
const CHARACTER_HOOKS = {
  jg: {
    // JG velocidade depende de hasBastao; hook é chamado em Player.update para ajustar this.speed
    getSpeedModifier(player){
      if(player.hasBastao) return player.characterDef ? player.characterDef.speedWithBastao : JG_SPEED_WITH_BASTAO;
      return player.characterDef ? player.characterDef.speedWithoutBastao : JG_SPEED_WITHOUT_BASTAO;
    },
    canEquipWeapon(player, weaponName){
      // JG lock: só Bastão para não duplicar e manter exclusivo
      const allowed = CHARACTER_DEFS.jg.allowedWeapons;
      return allowed.includes(weaponName);
    }
  },
  kinight: {
    canEquipWeapon(player, weaponName){
      const allowed = CHARACTER_DEFS.kinight.allowedWeapons;
      return allowed.includes(weaponName);
    }
  },
  jl: {
    canEquipWeapon(player, weaponName){
      return true; // JL pode equipar qualquer arma
    }
  },
  neutro: {
    canEquipWeapon(player, weaponName){
      return true; // Neutro pode equipar qualquer arma - versatilidade total
    }
  },
  oli: {
    canEquipWeapon(player, weaponName){
      return true; // Oli pode equipar qualquer arma - invocador versátil
    }
  },
  ash: {
    canEquipWeapon(player, weaponName){
      return true; // Ash pode pegar qualquer arma como secundária, motosserra nunca sai
    },
    canUseSpecial(player){
      return false; // Ash não pode usar itens especiais
    }
  },
  dev: {
    canEquipWeapon(player, weaponName){
      return true; // Dev pode equipar qualquer arma - versátil científico
    }
  }
};
function canCharacterEquipWeapon(characterId, weaponName){
  const hook = CHARACTER_HOOKS[characterId];
  if(hook && typeof hook.canEquipWeapon === 'function'){
    return hook.canEquipWeapon({characterDef: getCharacterDef(characterId)}, weaponName);
  }
  return true;
}
function applyCharacterToPlayer(player, characterId){
  const def = getCharacterDef(characterId);
  if(!def) return false;
  player.characterId = def.id;
  player.characterDef = def;
  player.characterName = def.displayName;
  player.characterIcon = def.icon;
  player.characterColor = def.color;
  // Vida base do personagem
  player.boneHearts = def.boneHearts|0;
  player.maxBoneHearts = BONE_HEART_MAX_CONTAINERS;
  // maxHp = base vermelha + boneHearts*2 (Bone Heart system)
  if(characterId==='kinight'){
    // 3 vermelhos (6) +1 bone (2) =8
    player.maxHp = def.maxHp + def.boneHearts*2;
  } else {
    player.maxHp = def.maxHp + def.boneHearts*2;
  }
  player.hp = player.maxHp;
  // Reseta estados exclusivos
  // JG
  if(characterId==='jg'){
    player.hasBastao = true;
    player.bastaoProjectile = null;
    player.isBastaoCharging = false;
    player.bastaoChargeTime = 0;
    player.bastaoChargeDir = null;
    player.bastaoHeavyReady = false;
  } else {
    player.hasBastao = false;
    player.bastaoProjectile = null;
    player.isBastaoCharging = false;
    player.bastaoChargeTime = 0;
    player.bastaoChargeDir = null;
  }
  // Reseta contaminação de outros personagens
  player.cyberHp = 0;
  player.maxCyberHp = CYBER_HEART_MAX_CYBER;
  // Arma inicial - inclui RAIO_MATEMATICO exclusivo Dev
  const wMap = { NORMAL: WEAPON_NORMAL, SHOTGUN: WEAPON_SHOTGUN, RAIO: WEAPON_RAIO, METRALHADORA: WEAPON_METRALHADORA, CARREGADA: WEAPON_CARREGADA, BAZUCA: WEAPON_BAZUCA, ESPADA: WEAPON_ESPADA, LUVA: WEAPON_LUVA, BASTAO: WEAPON_BASTAO, MOTOSSERRA: WEAPON_MOTOSSERRA, RAIO_MATEMATICO: WEAPON_RAIO_MATEMATICO };
  // limpa upgrades anteriores? Mantém? No startGame já reseta, mas aqui reconstrói com upgrades se houver
  // Starter weapon com upgrades vinculados (se já houver upgrades coletados, buildUpgraded)
  if(def.starterWeapon && wMap[def.starterWeapon]){
    // Usa createWeaponWithUpgrades se existir, senão copia base
    if(typeof player.buildUpgradedWeapon === 'function'){
      // Garante que weaponUpgrades está inicializado
      if(!player.weaponUpgrades) player.weaponUpgrades = { NORMAL:[], SHOTGUN:[], RAIO:[], RAIO_MATEMATICO:[], METRALHADORA:[], CARREGADA:[], BAZUCA:[], ESPADA:[], LUVA:[], MOTOSSERRA:[], BASTAO:[], ALL:[], SPECIAL:[] };
      // Para JG, adiciona suporte BASTAO e MOTOSSERRA
      if(!player.weaponUpgrades['BASTAO']) player.weaponUpgrades['BASTAO'] = [];
      if(!player.weaponUpgrades['MOTOSSERRA']) player.weaponUpgrades['MOTOSSERRA'] = [];
      if(!player.weaponUpgrades['RAIO_MATEMATICO']) player.weaponUpgrades['RAIO_MATEMATICO'] = [];
      const built = player.buildUpgradedWeapon(def.starterWeapon);
      player.primaryWeapon = built || {...wMap[def.starterWeapon]};
    } else {
      player.primaryWeapon = {...wMap[def.starterWeapon]};
    }
  } else {
    player.primaryWeapon = {...WEAPON_NORMAL};
  }
  // Para personagens locked, secundária é null (não usa Q)
  if(def.allowedWeapons && def.allowedWeapons.length===1){
    player.secondaryWeapon = null;
    player.weapon = player.primaryWeapon;
  } else {
    // JL e genéricos: secundária inicialmente null
    if(!player.secondaryWeapon) player.secondaryWeapon = null;
    player.weapon = player.primaryWeapon;
  }
  // Special inicial
  if(def.starterSpecial){
    const sp = createSpecialItem(def.starterSpecial);
    if(sp) player.equipSpecial(sp);
    else player.equippedSpecial = null;
  } else {
    // limpa se não tem starter mas mantém se for troca? No apply inicial limpa
    if(player.equippedSpecial && player.equippedSpecial.id === 'farmar_aura' && characterId!=='jl'){
      player.equippedSpecial = null;
    }
    if(player.equippedSpecial && player.equippedSpecial.id === 'oli_xadrez' && characterId!=='oli'){
      player.equippedSpecial = null;
    }
  }
  // Limpa flags de espada/guardião etc que possam vazar
  player.swordGuardianActive=false; player.swordGuardianCharges=0; player.swordGuardianTimer=0;
  // Dev - Raio Matemático flags
  if(characterId==='dev'){
    player.rayMatematicoChargeTime = 0;
    player.isRayMatematicoCharging = false;
    player.rayMatematicoChargeDir = null;
    player.rayMatematicoFiredThresholds = new Set();
    player.rayMatematicoReady = false;
  } else {
    // limpa se trocou de Dev para outro
    if(player.isRayMatematicoCharging) player.cancelRayMatematicoCharge();
    player.rayMatematicoChargeTime = 0;
    player.isRayMatematicoCharging = false;
    player.rayMatematicoChargeDir = null;
    if(player.rayMatematicoFiredThresholds) player.rayMatematicoFiredThresholds.clear();
  }
  return true;
}



// Helper som simples para novas armas (WebAudio fallback, não quebra se sem áudio)
function playWeaponSound(type, heavy=false){
  try{
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = heavy ? 'sawtooth' : 'square';
    let freq=240;
    if(type==='ESPADA') freq = heavy? 180 : 520;
    else if(type==='LUVA') freq = 220;
    // MARTELO/LANCA/ARCO/MACHADO removidos
    else if(type==='SHOTGUN') freq=180;
    else if(type==='RAIO') freq=720;
    else if(type==='RAIO_MATEMATICO') freq = heavy? 480 : 660;
    else if(type==='BAZUCA') freq=90;
    o.frequency.value=freq;
    g.gain.value=0.09;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.18);
    o.stop(ctx.currentTime+0.20);
    setTimeout(()=>{ try{ctx.close();}catch(e){} }, 300);
  }catch(e){}
}

// ===================== POWER STAR ⭐ (RARO) =====================
const POWER_STAR_COOLDOWN = 50000; // 50s cooldown (variável balanceável)
const POWER_STAR_DURATION = 7000;  // 7s de invencibilidade (variável balanceável)
const POWER_STAR_DAMAGE = 3;       // dano ao tocar (1.5 corações)
const POWER_STAR_TOUCH_INTERVAL = 320; // ms entre ticks de dano por contato
const POWER_STAR_SPAWN_CHANCE = 0.009; // 0.9% por sala normal, mais alta em tesouro/rare
const POWER_STAR_TREASURE_CHANCE = 0.018;

// ===================== BOSS FASE 5 - SALA DA ESCADA =====================
// Boss épico com 3 fases, adaptação e combos. Balanceado para ser desafiador mas justo.
// NÃO aumenta só vida/dano: dificuldade vem de mecânicas, padrões e decisão.
// Vida base levemente maior (48) para sustentar 3 fases sem bullet sponge.
const BOSS5_HP = 48;              // vida da cabeça (balanceável) - 3 fases usam threshold
const BOSS5_HAND_HP = 18;         // vida de CADA mão (18 -> fase2 exige foco)
const BOSS5_SIZE = 44;            // cabeça
const BOSS5_HAND_SIZE = 34;
const BOSS5_MOVE_SPEED = 1.42;    // compat: velocidade fase1 (legado)
const BOSS5_ARENA_Y = 84;         // Y da cabeça (topo)
const BOSS5_HAND_OFFSET_X = 78;   // distância horizontal das mãos até a cabeça
const BOSS5_HAND_OFFSET_Y = 44;   // distância vertical das mãos até a cabeça
const BOSS5_HAND_SLAM_INTERVAL = 2400; // compat fase1
const BOSS5_HAND_SLAM_DAMAGE = 2; // dano se a mão esmagar jogador
const BOSS5_PROJECTILE_SPEED = 3.6;
const BOSS5_PROJECTILE_SIZE = 6;
const BOSS5_PROJECTILE_DAMAGE = 1;
const BOSS5_RAY_WARNING = 950;    // compat fase1
const BOSS5_RAY_COOLDOWN = 5200;  // compat fase1
const BOSS5_RAY_DAMAGE = 2;
const BOSS5_RAY_WIDTH = 18;
const BOSS5_SUMMON_COOLDOWN = 4600; // compat fase1
const BOSS5_SUMMON_MAX = 2;       // por ciclo
const BOSS5_SUMMON_TOTAL_MAX = 5; // total simultâneo na arena
// --- Novas constantes épicas: 3 fases + adaptação + novos ataques ---
const BOSS5_PHASE2_AT = 0.64; // 64% HP entra fase2 (antes 50%) -> mais tempo em fase intermediária
const BOSS5_PHASE3_AT = 0.34; // 34% HP entra fase final desesperada
const BOSS5_MOVE_SPEED_P1 = 1.42;
const BOSS5_MOVE_SPEED_P2 = 1.92;
const BOSS5_MOVE_SPEED_P3 = 2.38;
const BOSS5_ENRAGE_SPEED_FACTOR = 0.22; // +22% ao longo de ~75s de luta (gradual)
const BOSS5_HAND_SLAM_INTERVAL_P1 = 2400;
const BOSS5_HAND_SLAM_INTERVAL_P2 = 1750;
const BOSS5_HAND_SLAM_INTERVAL_P3 = 1380;
const BOSS5_HAND_SLAM_DUR = 380; // duração batida (mais rápida que antes 420)
const BOSS5_DOUBLE_SLAM_COOLDOWN = 5200; // intervalo entre batidas duplas
const BOSS5_SHOCKWAVE_MAX = 112;
const BOSS5_SHOCKWAVE_SPEED = 2.85;
const BOSS5_SHOCKWAVE_DMG = 1;
const BOSS5_SHOCKWAVE_RING_WIDTH = 14;
const BOSS5_RAY_WARNING_P1 = 950;
const BOSS5_RAY_WARNING_P2 = 820;
const BOSS5_RAY_WARNING_P3 = 680;  // ainda justo (>650ms mínimo)
const BOSS5_RAY_COOLDOWN_P1 = 5200;
const BOSS5_RAY_COOLDOWN_P2 = 3900;
const BOSS5_RAY_COOLDOWN_P3 = 3100;
const BOSS5_RAY_DURATION = 880;
const BOSS5_SWEEP_DURATION = 1150;
const BOSS5_RAY_WIDTH_SWEEP = 22;
const BOSS5_SUMMON_COOLDOWN_P1 = 4600;
const BOSS5_SUMMON_COOLDOWN_P2 = 3400;
const BOSS5_SUMMON_COOLDOWN_P3 = 2700;
const BOSS5_METEOR_WARNING = 780;
const BOSS5_METEOR_COOLDOWN_P2 = 6800;
const BOSS5_METEOR_COOLDOWN_P3 = 5200;
const BOSS5_METEOR_COUNT = 4;
const BOSS5_METEOR_RADIUS = 38;
const BOSS5_DASH_PREP = 620;
const BOSS5_DASH_SPEED = 6.8;
const BOSS5_DASH_DURATION = 310;
const BOSS5_DASH_COOLDOWN = 8200;
const BOSS5_VULN_WINDOW_P3 = 1350; // janela curta e clara na fase3
const BOSS5_VULN_COOLDOWN_P3 = 2800; // tempo shielded entre janelas fase3
const BOSS5_VULN_SHIELDED_DMG_FACTOR = 0.28; // fora da janela dano reduzido mas não zero (justo)
const BOSS5_SPIRAL_COUNT = 10;
const BOSS5_SPIRAL_COOLDOWN = 3600;
const BOSS5_ADAPT_CAMP_TIME = 1750; // se ficar parado 1.75s, punição
const BOSS5_ADAPT_QUADRANT_TIME = 3200;
const BOSS5_SPOTLIGHT_DMG_BONUS = 1.55; // mãos no chão tomam +55% dano (janela de punição)

// ===================== HACKER - BOSS FINAL SECRETO (FASE FINAL) =====================
// Boss secreto após Boss da Escada, sala corrompida com glitches e Dark Vírus
// Mesmo tamanho do jogador, visual parecido com Neutro mas corrompido/hacker
const HACKER_HP = 52; // vida total (4 fases: 13 / 13 / 20.8 / 5.2)
const HACKER_SIZE = 24; // mesmo do jogador
const HACKER_SPEED = 1.85;
const HACKER_DASH_SPEED = 7.2;
const HACKER_DASH_DURATION = 260;
const HACKER_DASH_COOLDOWN = 2100;
const HACKER_DASH_PREP = 420;
const HACKER_SHOOT_COOLDOWN_P1 = 720; // 100-75% frequência tiros normais
const HACKER_BULLET_SPEED = 6.8;
const HACKER_BULLET_DAMAGE = 1; // tiro normal 0.5 coração
const HACKER_BULLET_SIZE = 5;
const HACKER_BAZOOKA_COOLDOWN = 1700; // fase 75-50%
const HACKER_BAZOOKA_DAMAGE = 4; // 2 corações (2 de dano = 1 coração? Usamos 4=2 corações para impacto)
const HACKER_BAZOOKA_SPEED = 4.2;
const HACKER_BAZOOKA_RADIUS = 72;
const HACKER_SUMMON_COOLDOWN_P2 = 3600; // fase 2 summon
const HACKER_SUMMON_COOLDOWN_P3 = 3200; // fase 3 summon mais frequente
const HACKER_HEAL_SPAWN_COOLDOWN = 4200; // fase 3 cura
const HACKER_CAR_COOLDOWN = 8500; // tempo até chamar carro (fase 50-10%)
const HACKER_CAR_SPEED = 11.5; // alta velocidade reta
const HACKER_CAR_DAMAGE = 5; // 2.5 corações
const HACKER_CAR_PREP_TIME = 900; // aviso antes do carro aparecer
const HACKER_CAR_DURATION = 700; // duração do atropelo
const HACKER_PUNCH_RANGE = 36;
const HACKER_PUNCH_ANGLE = 90;
const HACKER_PUNCH_DAMAGE = 2; // 1 coração por soco
const HACKER_PUNCH_COOLDOWN = 520;
const HACKER_GLITCH_INTERVAL = 180; // glitch visual a cada 180ms na sala
const HACKER_DIALOG_TIME = 2200; // duração do diálogo inicial

// Corrupted Stair & Hacker Room
const HACKER_ROOM_GLITCH_COLORS = ['#00ff88','#ff0040','#00e5ff','#ffcc00','#c084fc'];
const HACKER_CORRUPTED_STAIR_SIZE_W = 56;
const HACKER_CORRUPTED_STAIR_SIZE_H = 42;

// --- Fases ---
const FLOOR_THEMES = {
  1: {
    id: 1, name: 'INTERFACE CORROMPIDA',
    floorA: '#141222', floorB: '#1a182e',
    wall: '#2a2640', wallTop: '#3a3450', wallLine: 'rgba(0,0,0,0.2)',
    bg: '#0a0a12', accent: '#8a6cff', doorLocked: '#4a1a10',
    decor: 'porão', vignette: 'rgba(0,0,0,0.35)'
  },
  2: {
    id: 2, name: 'VARIÁVEL BUGADA',
    floorA: '#1e1410', floorB: '#281a10',
    wall: '#4a3020', wallTop: '#6b4a2d', wallLine: 'rgba(0,0,0,0.25)',
    bg: '#0f0a08', accent: '#ff8c42', doorLocked: '#5a1a0a',
    decor: 'caverna', vignette: 'rgba(60,20,0,0.32)'
  },
  3: {
    id: 3, name: 'ALGORITMO TÓXICO',
    floorA: '#0f1a18', floorB: '#142a24',
    wall: '#1e3a32', wallTop: '#2a5a4a', wallLine: 'rgba(0,60,40,0.25)',
    bg: '#060e0c', accent: '#00ff88', doorLocked: '#0a3a1a',
    decor: 'abismo', vignette: 'rgba(0,40,30,0.38)'
  },
  4: {
    id: 4, name: 'CÓDIGOS CORROMPIDOS',
    floorA: '#1a1020', floorB: '#241836',
    wall: '#3a204a', wallTop: '#5a306a', wallLine: 'rgba(80,40,100,0.28)',
    bg: '#0d0a14', accent: '#d946ef', doorLocked: '#3a1040',
    decor: 'santuário', vignette: 'rgba(40,10,50,0.42)'
  },
  5: {
    id: 5, name: 'VÍRUS SOMBRIO',
    floorA: '#1c1410', floorB: '#281c14',
    wall: '#4a2e18', wallTop: '#6b4220', wallLine: 'rgba(80,40,10,0.28)',
    bg: '#0f0906', accent: '#ffd700', doorLocked: '#5a1a0a',
    decor: 'escada', vignette: 'rgba(80,40,0,0.38)'
  }
};

// ===================== UTILITÁRIOS =====================
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
function randRange(a, b) { return a + Math.random() * (b - a); }
function randInt(a, b) { return Math.floor(randRange(a, b + 1)); }
function normalize(x,y){ const l=Math.hypot(x,y)||1; return {x:x/l,y:y/l}; }
function angleDiff(a,b){ return Math.atan2(Math.sin(b-a), Math.cos(b-a)); }

// RNG com seed (mulberry32) para mapa procedural reprodutível/debug
function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Colisões AABB
function rectCollide(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
function circleRectCollide(cx, cy, r, rx, ry, rw, rh) {
  const closestX = clamp(cx, rx, rx + rw);
  const closestY = clamp(cy, ry, ry + rh);
  return dist(cx, cy, closestX, closestY) < r;
}

// ===================== INPUT HANDLER =====================
class InputHandler {
  constructor() {
    this.keys = new Set();
    this.justPressed = new Set();
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (!this.keys.has(k)) this.justPressed.add(k);
      if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
      this.keys.add(k);
      this.keys.add(e.key);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
      this.keys.delete(e.key);
    });
    window.addEventListener('blur', () => { this.keys.clear(); });
  }
  isDown(k) { return this.keys.has(k) || this.keys.has(k.toLowerCase()); }
  consumeJustPressed(k) {
    const low = k.toLowerCase();
    if (this.justPressed.has(low) || this.justPressed.has(k)) {
      this.justPressed.delete(low); this.justPressed.delete(k);
      return true;
    }
    return false;
  }
  getMoveVector() {
    let x = 0, y = 0;
    if (this.isDown('w')) y -= 1;
    if (this.isDown('s')) y += 1;
    if (this.isDown('a')) x -= 1;
    if (this.isDown('d')) x += 1;
    if (x !== 0 && y !== 0) { const inv = 1 / Math.sqrt(2); x *= inv; y *= inv; }
    return { x, y };
  }
  getShootVector() {
    let x = 0, y = 0;
    if (this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('ArrowRight')) x += 1;
    if (this.isDown('ArrowUp')) y -= 1;
    if (this.isDown('ArrowDown')) y += 1;
    if (x === 0 && y === 0) return null;
    if (x !== 0 && y !== 0) { const inv = 1 / Math.sqrt(2); x *= inv; y *= inv; }
    return { x, y };
  }
  isDashPressed() { return this.isDown('Shift') || this.isDown('shift'); }
  update() { this.justPressed.clear(); }
}

// ===================== PARTICLE =====================
class Particle {
  constructor(x, y, vx, vy, life, color, size, decay = 0.92) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life;
    this.color = color; this.size = size;
    this.decay = decay;
    this.alpha = 1;
  }
  update(dt) {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= this.decay;
    this.vy *= this.decay;
    this.vy += 0.15;
    this.life -= dt;
    this.alpha = clamp(this.life / this.maxLife, 0, 1);
    return this.life > 0;
  }
  draw(ctx) {
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.fillRect(Math.round(this.x), Math.round(this.y), this.size, this.size);
    ctx.globalAlpha = 1;
  }
}

// ===================== FIRE PATCH (Rastro de Fogo) =====================
class FirePatch {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.radius = fireRadius;
    this.damage = fireDamage;
    this.duration = fireDuration;
    this.tickRate = fireTickRate;
    this.life = fireDuration;
    this.tickTimer = 0; // pronto para dar dano imediato
    this.anim = Math.random()*Math.PI*2;
    this.dead = false;
  }
  update(dt){
    this.life -= dt;
    this.tickTimer -= dt;
    this.anim += dt*0.006;
    if(this.life <= 0) this.dead = true;
    return !this.dead;
  }
  canTick(){ return this.tickTimer <= 0; }
  resetTick(){ this.tickTimer = this.tickRate; }
  draw(ctx){
    const alpha = clamp(this.life / this.duration, 0, 1);
    const pulse = 0.7 + Math.sin(this.anim*3)*0.3;
    // brilho externo
    ctx.globalAlpha = alpha * 0.28 * pulse;
    ctx.fillStyle = '#ff6a00';
    ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + 10, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = alpha * 0.45 * pulse;
    ctx.fillStyle = '#ff3b00';
    ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + 4, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = alpha;
    // núcleo
    ctx.fillStyle = '#ff8c00';
    ctx.beginPath(); ctx.arc(this.x, this.y, this.radius*0.65, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath(); ctx.arc(this.x + Math.sin(this.anim*2)*2, this.y -2, this.radius*0.35, 0, Math.PI*2); ctx.fill();
    // chama pixelada superior
    ctx.fillStyle = `rgba(255,255,255,${alpha*0.8})`;
    ctx.fillRect(Math.round(this.x -1 + Math.sin(this.anim*4)*1.5), Math.round(this.y - this.radius*0.5), 2, 3);
    ctx.globalAlpha = 1;
    // contorno
    ctx.strokeStyle = `rgba(255,60,0,${alpha*0.5})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); ctx.stroke();
  }
}

// ===================== SPIKE (Espinhos) =====================
class Spike {
  constructor(x, y, size = SPIKE_SIZE) {
    this.x = x; this.y = y;
    this.w = size; this.h = size;
    this.damage = spikeDamage;
    this.cooldown = spikeCooldown;
    this.anim = Math.random()*Math.PI*2;
  }
  update(dt){ this.anim += dt*0.004; }
  // verifica colisão com jogador; dano é tratado no Room com cooldown do jogador
  collides(player){
    return rectCollide(player.x - player.w/2, player.y - player.h/2, player.w, player.h,
                       this.x - this.w/2, this.y - this.h/2, this.w, this.h);
  }
  draw(ctx){
    const x=this.x - this.w/2, y=this.y - this.h/2;
    const bob = Math.sin(this.anim*2.2)*1.2;
    // base
    ctx.fillStyle='rgba(0,0,0,0.25)';
    ctx.fillRect(x+2, y+this.h-4, this.w, 3);
    ctx.fillStyle='#2a2a2e';
    ctx.fillRect(x, y+8 + bob, this.w, this.h-8);
    // espinhos pontiagudos (3 picos)
    ctx.fillStyle='#8a8a8e';
    for(let i=0;i<3;i++){
      const px = x + 5 + i*8;
      ctx.beginPath();
      ctx.moveTo(px, y+4 + bob);
      ctx.lineTo(px-4, y+10 + bob);
      ctx.lineTo(px+4, y+10 + bob);
      ctx.closePath(); ctx.fill();
      // brilho pico
      ctx.fillStyle='#c0c0c6';
      ctx.fillRect(px-0.5, y+5 + bob, 1, 3);
      ctx.fillStyle='#8a8a8e';
    }
    // borda verde tóxica fase 3 (leve)
    ctx.strokeStyle='rgba(0,255,136,0.18)';
    ctx.lineWidth=1;
    ctx.strokeRect(x, y+8 + bob, this.w, this.h-8);
  }
}

// ===================== KAMIKAZE =====================
class Kamikaze {
  constructor(x, y){
    this.x=x; this.y=y;
    this.w=KAMIKAZE_SIZE; this.h=KAMIKAZE_SIZE;
    this.hp=KAMIKAZE_HP; this.maxHp=KAMIKAZE_HP;
    this.speed=KAMIKAZE_SPEED;
    this._baseSpeed=KAMIKAZE_SPEED;
    this.dead=false; this.exploded=false;
    this.anim=Math.random()*1000;
    this.hitFlash=0;
    this.damageCooldown=0;
    this.type='kamikaze';
    this.collisionDamage = 1;
    this.explosionDamage = explosionDamage;
    this.explosionRadius = explosionRadius;
    this.variation = null;
    this.flashTimer=0; // pisca antes de explodir
    this.slowTimer=0; this.slowFactor=1; this.stunTimer=0;
  }
  takeDamage(dmg){
    this.hp-=dmg; this.hitFlash=140;
    if(this.hp<=0 && !this.exploded){
      // explode automaticamente ao morrer (tratado externamente para efeito em área)
      this.dead=true;
      return true; // sinaliza morte para Game/Room disparar explosão
    }
    return false;
  }
  canDamage(){ return this.damageCooldown<=0; }
  resetDamageCooldown(){ this.damageCooldown=ENEMY_DAMAGE_COOLDOWN; }
  collidesWalls(nx,ny,walls){
    const hw=this.w/2, hh=this.h/2, rx=nx-hw, ry=ny-hh;
    for(const w of walls) if(rectCollide(rx,ry,this.w,this.h,w.x,w.y,w.w,w.h)) return true;
    return false;
  }
  update(dt, player, walls){
    this.anim+=dt;
    if(this.hitFlash>0) this.hitFlash-=dt;
    if(this.damageCooldown>0) this.damageCooldown-=dt;
    if(this.stunTimer>0){ this.stunTimer-=dt; if(this.stunTimer<=0) this.stunTimer=0; return; }
    let effSpeed=this._baseSpeed;
    if(this.slowTimer>0){ this.slowTimer-=dt; if(this.slowTimer<=0){this.slowTimer=0; this.slowFactor=1; this.speed=this._baseSpeed;} else effSpeed=this._baseSpeed*this.slowFactor; } else this.speed=this._baseSpeed;
    if(this.dead) return;
    const d=dist(this.x,this.y, player.x, player.y);
    const isClose = d < KAMIKAZE_DETECT_RADIUS;
    if(isClose){
      // pisca indicando prestes a explodir quando muito próximo
      if(d < 70) this.flashTimer+=dt;
      else this.flashTimer=0;
      const dir=normalize(player.x - this.x, player.y - this.y);
      let nx=this.x + dir.x * effSpeed;
      let ny=this.y + dir.y * effSpeed;
      // evita parede simples
      if(!this.collidesWalls(nx, this.y, walls)) this.x=nx;
      if(!this.collidesWalls(this.x, ny, walls)) this.y=ny;
      this.x=clamp(this.x, WALL_THICK+this.w/2, CANVAS_W-WALL_THICK-this.w/2);
      this.y=clamp(this.y, WALL_THICK+this.h/2, CANVAS_H-WALL_THICK-this.h/2);
      // se encostar no jogador, explode imediatamente
      if(d < (this.w+player.w)*0.48){
        this.dead=true; // marca para explosão no Room
        // Room cuidará de aplicar dano em área
      }
    } else {
      // patrulha leve quando longe
      this.flashTimer=0;
      this.x += Math.sin(this.anim*0.005)*0.35;
      this.y += Math.cos(this.anim*0.004)*0.35;
    }
  }
  // chamado por Room quando o kamikaze morre/explode: retorna lista de entidades atingidas já tratada externamente
  draw(ctx){
    const x=this.x - this.w/2, y=this.y - this.h/2;
    const bob=Math.sin(this.anim*0.012)*1.5;
    const flashing = this.flashTimer>0 && Math.floor(this.flashTimer/90)%2===0;
    const isFlash=this.hitFlash>0 && Math.floor(this.hitFlash/40)%2===0;
    if(this.stunTimer>0){
      const pulse=0.5+Math.sin(this.anim*0.015)*0.35;
      ctx.fillStyle=`rgba(255,215,0,${0.18+pulse*0.12})`;
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.9+pulse*3,0,Math.PI*2); ctx.fill();
    } else if(this.slowTimer>0){
      ctx.fillStyle=`rgba(96,165,250,0.14)`;
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.85,0,Math.PI*2); ctx.fill();
    }
    drawVariationAura(ctx,this,bob);
    ctx.fillStyle='rgba(0,0,0,0.32)'; ctx.fillRect(x+2, y+this.h-3, this.w, 3);
    // corpo - variação
    let kamiBase='#ff3b30'; if(this.variation==='tank') kamiBase='#3a6ea5'; else if(this.variation==='brute') kamiBase='#8b1a10'; else if(this.variation==='elite') kamiBase='#6d28d9';
    ctx.fillStyle= flashing ? '#ff6a00' : isFlash ? '#ffaaaa' : this.stunTimer>0?'#a1a1aa' : this.slowTimer>0?'#60a5fa':kamiBase;
    ctx.fillRect(x+2, y+6 + bob, this.w-4, this.h-8);
    // pavio
    ctx.fillStyle='#3a1a00';
    ctx.fillRect(x+this.w/2 -1, y+1 + bob, 2, 6);
    // faísca pavio
    if(flashing || Math.random()<0.25){
      ctx.fillStyle=['#ffcc00','#00e5ff','#ffffff'][Math.floor(Math.random()*3)];
      ctx.fillRect(x+this.w/2 -2 + randRange(-1,1), y+ bob, 4, 4);
    }
    // olhos nervosos
    ctx.fillStyle='#1a0000';
    ctx.fillRect(x+6, y+10 + bob, 5,5);
    ctx.fillRect(x+15, y+10 + bob, 5,5);
    ctx.fillStyle= flashing ? '#ffcc00' : '#ffffff';
    ctx.fillRect(x+7, y+11 + bob, 3,2);
    ctx.fillRect(x+16, y+11 + bob, 3,2);
    // barra vida
    if(this.hp < this.maxHp){
      const pct=clamp(this.hp/this.maxHp,0,1);
      ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(x, y-6 + bob, this.w, 4);
      ctx.fillStyle='#ef4444'; ctx.fillRect(x, y-6 + bob, this.w*pct, 4);
    }
    drawVariationIcon(ctx,this,x,y,bob);
    // círculo de aviso quando muito próximo
    if(flashing){
      ctx.strokeStyle='rgba(255,60,0,0.55)';
      ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(this.x, this.y + bob, explosionRadius*0.35, 0, Math.PI*2); ctx.stroke();
    }
  }
  getRect(){ return {x:this.x-this.w/2,y:this.y-this.h/2,w:this.w,h:this.h}; }
}

// ===================== SUMMONER (Invocador) =====================
class Summoner {
  constructor(x, y){
    this.x=x; this.y=y;
    this.w=SUMMONER_SIZE; this.h=SUMMONER_SIZE;
    this.hp=SUMMONER_HP; this.maxHp=SUMMONER_HP;
    this.speed=SUMMONER_SPEED;
    this._baseSpeed=SUMMONER_SPEED;
    this.dead=false; this.hitFlash=0; this.anim=Math.random()*1000;
    this.type='summoner';
    this.collisionDamage = 1;
    this.variation = null;
    this.damageCooldown=0;
    this.summonTimer=summonCooldown + randRange(-500,600);
    this.summoned=[]; // referências aos inimigos invocados vivos
    this.auraAnim=0;
    this.slowTimer=0; this.slowFactor=1; this.stunTimer=0;
  }
  takeDamage(dmg){ this.hp-=dmg; this.hitFlash=150; if(this.hp<=0){ this.dead=true; return true; } return false; }
  canDamage(){ return this.damageCooldown<=0; }
  resetDamageCooldown(){ this.damageCooldown=ENEMY_DAMAGE_COOLDOWN; }
  collidesWalls(nx,ny,walls){
    const hw=this.w/2, hh=this.h/2, rx=nx-hw, ry=ny-hh;
    for(const w of walls) if(rectCollide(rx,ry,this.w,this.h,w.x,w.y,w.w,w.h)) return true;
    return false;
  }
  update(dt, player, walls, spawnList, allEnemies){
    this.anim+=dt; this.auraAnim+=dt*0.005;
    if(this.hitFlash>0) this.hitFlash-=dt;
    if(this.damageCooldown>0) this.damageCooldown-=dt;
    if(this.summonTimer>0) this.summonTimer-=dt;
    if(this.stunTimer>0){ this.stunTimer-=dt; if(this.stunTimer<=0) this.stunTimer=0; return; }
    let effSpeed=this._baseSpeed;
    if(this.slowTimer>0){ this.slowTimer-=dt; if(this.slowTimer<=0){this.slowTimer=0; this.slowFactor=1; this.speed=this._baseSpeed;} else effSpeed=this._baseSpeed*this.slowFactor; } else this.speed=this._baseSpeed;
    if(this.dead) return;
    // mantém distância: foge se muito perto
    const d=dist(this.x,this.y, player.x, player.y);
    const desired=180;
    let mvx=0, mvy=0;
    if(d < 140){
      const dir=normalize(this.x - player.x, this.y - player.y);
      mvx=dir.x*effSpeed; mvy=dir.y*effSpeed;
    } else if(d > 230){
      const dir=normalize(player.x - this.x, player.y - this.y);
      mvx=dir.x*effSpeed*0.45; mvy=dir.y*effSpeed*0.45;
    } else {
      // orbita lateral
      const perp = Math.sin(this.anim*0.002);
      mvx = - (player.y - this.y)/ (d||1) * perp * 0.9;
      mvy = (player.x - this.x)/ (d||1) * perp * 0.9;
    }
    let nx=this.x + mvx, ny=this.y + mvy;
    if(!this.collidesWalls(nx, this.y, walls)) this.x=nx;
    if(!this.collidesWalls(this.x, ny, walls)) this.y=ny;
    this.x=clamp(this.x, WALL_THICK+this.w/2, CANVAS_W-WALL_THICK-this.w/2);
    this.y=clamp(this.y, WALL_THICK+this.h/2, CANVAS_H-WALL_THICK-this.h/2);

    // limpa summoneds mortos da lista
    this.summoned = this.summoned.filter(e=> !e.dead && allEnemies.includes(e));
    // invoca periodicamente se abaixo do limite
    if(this.summonTimer<=0 && this.summoned.length < maxSummonedEnemies){
      // escolhe posição perto do invocador mas não em parede
      let sx, sy, tries=0;
      do{
        const ang=Math.random()*Math.PI*2, r=randRange(38,72);
        sx=this.x + Math.cos(ang)*r; sy=this.y + Math.sin(ang)*r;
        tries++;
        let onWall=false;
        for(const w of walls) if(rectCollide(sx-10,sy-10,20,20,w.x,w.y,w.w,w.h)){ onWall=true; break; }
        if(!onWall && dist(sx,sy,player.x,player.y)>60) break;
      }while(tries<12);
      // cria chaser enfraquecido (variação reduzida para invocados)
      const e=new Chaser(sx,sy);
      e.hp=summonedEnemyHealth; e.maxHp=summonedEnemyHealth;
      e.speed=summonedEnemySpeed;
      e.isSummoned=true;
      e.w=22; e.h=22; // menor visual
      applyEnemyVariation(e, Math.random, 1);
      spawnList.push(e);
      this.summoned.push(e);
      this.summonTimer = summonCooldown + randRange(-320,420);
      // efeito será desenhado no Game via partículas (aura)
    }
  }
  draw(ctx){
    const x=this.x - this.w/2, y=this.y - this.h/2, bob=Math.sin(this.anim*0.008)*1.4;
    const isFlash=this.hitFlash>0 && Math.floor(this.hitFlash/42)%2===0;
    if(this.stunTimer>0){
      const pulse=0.5+Math.sin(this.anim*0.015)*0.35;
      ctx.fillStyle=`rgba(255,215,0,${0.18+pulse*0.12})`;
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.95+pulse*3,0,Math.PI*2); ctx.fill();
    } else if(this.slowTimer>0){
      ctx.fillStyle=`rgba(96,165,250,0.13)`;
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.88,0,Math.PI*2); ctx.fill();
    }
    drawVariationAura(ctx,this,bob);
    ctx.fillStyle='rgba(0,0,0,0.32)'; ctx.fillRect(x+2, y+this.h-3, this.w, 3);
    // aura mágica pulsante (indica invocação)
    const summonPulse = 1 - clamp(this.summonTimer / summonCooldown, 0, 1);
    const auraAlpha = 0.12 + summonPulse*0.22 + Math.sin(this.auraAnim*4)*0.06;
    ctx.fillStyle=`rgba(138,92,255,${auraAlpha})`;
    ctx.beginPath(); ctx.arc(this.x, this.y + bob, this.w*0.85 + summonPulse*8, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle=`rgba(180,140,255,${0.35 + summonPulse*0.35})`;
    ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(this.x, this.y + bob, this.w*0.9 + Math.sin(this.auraAnim*3)*3, 0, Math.PI*2); ctx.stroke();
    // círculo mágico no chão
    ctx.strokeStyle=`rgba(138,92,255,${0.25 + Math.sin(this.auraAnim*2)*0.1})`;
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.ellipse(this.x, y+this.h-2, 16, 6, 0, 0, Math.PI*2); ctx.stroke();
    // corpo - variação
    let summBase='#6d28d9'; if(this.variation==='tank') summBase='#2a4a7a'; else if(this.variation==='brute') summBase='#7a1a10'; else if(this.variation==='elite') summBase='#4a1a6a';
    ctx.fillStyle=isFlash?'#e0d0ff': this.stunTimer>0?'#a1a1aa' : this.slowTimer>0?'#60a5fa':summBase;
    ctx.fillRect(x+3, y+6 + bob, this.w-6, this.h-10);
    ctx.fillStyle=isFlash?'#ffaaaa': this.stunTimer>0?'#6b7280' : this.slowTimer>0?'#3b82f6':'#4c1d95';
    ctx.fillRect(x, y+8 + bob, 3, this.h-12);
    ctx.fillRect(x+this.w-3, y+8 + bob, 3, this.h-12);
    // capuz
    ctx.fillStyle=isFlash?'#ffffff':'#1e1b4b';
    ctx.fillRect(x+5, y+2 + bob, this.w-10, 8);
    // olhos
    ctx.fillStyle='#00ff88';
    const eyeY=y+8 + bob;
    ctx.fillRect(x+7, eyeY, 4,4);
    ctx.fillRect(x+17, eyeY, 4,4);
    ctx.fillStyle='#ffffff';
    ctx.fillRect(x+8, eyeY+1, 1,1);
    ctx.fillRect(x+18, eyeY+1, 1,1);
    // invoca brilho quando prestes a invocar (<700ms)
    if(this.summonTimer < 700){
      const t= 1 - this.summonTimer/700;
      ctx.fillStyle=`rgba(255,255,255,${0.35 + t*0.4})`;
      ctx.beginPath(); ctx.arc(this.x, this.y -6 + bob, 3 + t*4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle=`rgba(138,92,255,${0.5})`;
      // partículas ao redor
      for(let i=0;i<3;i++){
        const ang=this.auraAnim*6 + i*2.1;
        const rx=this.x + Math.cos(ang)*(10 + t*6);
        const ry=this.y + Math.sin(ang)*(10 + t*6) + bob;
        ctx.fillRect(rx, ry, 2,2);
      }
    }
    // barra vida
    if(this.hp < this.maxHp){
      const pct=clamp(this.hp/this.maxHp,0,1);
      ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(x, y-7 + bob, this.w, 4);
      ctx.fillStyle=pct>0.5?'#a78bfa':'#ef4444'; ctx.fillRect(x, y-7 + bob, this.w*pct, 4);
    }
    drawVariationIcon(ctx,this,x,y,bob);
    // contador invocados
    if(this.summoned.length>0){
      ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(x+this.w-8, y-2 + bob, 8, 8);
      ctx.fillStyle='#fff'; ctx.font='6px monospace'; ctx.textAlign='center';
      ctx.fillText(String(this.summoned.length), x+this.w-4, y+4 + bob);
      ctx.textAlign='left';
    }
  }
  getRect(){ return {x:this.x-this.w/2,y:this.y-this.h/2,w:this.w,h:this.h}; }
}

// ===================== MINIBOSS FASE 4 (Santuário) =====================
// Miniboss de controle de área: parado, dispara cruz/X, investida previsível, fase 2 com invocação
class Miniboss {
  constructor(x, y){
    this.x=x; this.y=y;
    this.w=MINIBOSS_SIZE; this.h=MINIBOSS_SIZE;
    this.hp=MINIBOSS_HP; this.maxHp=MINIBOSS_HP;
    this.dead=false; this.hitFlash=0; this.anim=0;
    this.type='miniboss';
    this.damageCooldown=0;
    // Ataques
    this.attackTimer= 1200 + Math.random()*600; // primeiro ataque rápido
    this.nextPattern='cross'; // alterna cruz/X
    this.prepTimer=0; this.isPrepping=false; this.prepPattern=null;
    this.prepIndicator=0; // 0..1 para visual
    // Dash
    this.dashCooldown= 4200 + Math.random()*1200;
    this.dashPrep=0; this.isDashing=false; this.dashDir={x:0,y:0}; this.dashTime=0;
    this.dashTrail=[];
    // Fase 2
    this.phase2=false;
    this.summonTimer=MINIBOSS_SUMMON_COOLDOWN;
    this.summons=[]; // referência invocados
    // Efeitos
    this.phaseFlash=0;
  }
  takeDamage(dmg){
    this.hp-=dmg; this.hitFlash=140;
    if(this.hp<=0){ this.dead=true; return true; }
    // Checa fase 2 em 20%
    if(!this.phase2 && this.hp <= this.maxHp * MINIBOSS_PHASE2_HP){
      this.enterPhase2();
    }
    return false;
  }
  enterPhase2(){
    this.phase2=true;
    this.phaseFlash=900;
    this.summonTimer=900; // invoca rápido ao entrar
    this.attackTimer=Math.min(this.attackTimer, 800); // ataque mais frequente
  }
  canDamage(){ return this.damageCooldown<=0; }
  resetDamageCooldown(){ this.damageCooldown=900; }
  collidesWalls(nx,ny,walls){
    const hw=this.w/2, hh=this.h/2, rx=nx-hw, ry=ny-hh;
    for(const w of walls) if(rectCollide(rx,ry,this.w,this.h,w.x,w.y,w.w,w.h)) return true;
    return false;
  }
  update(dt, player, walls, bulletOut, spawnList, allEnemies, particles){
    this.anim+=dt;
    if(this.hitFlash>0) this.hitFlash-=dt;
    if(this.damageCooldown>0) this.damageCooldown-=dt;
    if(this.phaseFlash>0) this.phaseFlash-=dt;
    if(this.dead) return;
    // Stun/slow não afeta miniboss (imune) - mas permite ser afetado? decide imune para ser desafio
    // Dash preparação e execução têm prioridade
    if(this.isDashing){
      this.dashTime-=dt;
      // move rápido
      const nx=this.x + this.dashDir.x * MINIBOSS_DASH_SPEED;
      const ny=this.y + this.dashDir.y * MINIBOSS_DASH_SPEED;
      let hitWall=false;
      if(this.collidesWalls(nx, this.y, walls)) hitWall=true; else this.x=nx;
      if(this.collidesWalls(this.x, ny, walls)) hitWall=true; else this.y=ny;
      this.x=clamp(this.x, WALL_THICK+this.w/2, CANVAS_W-WALL_THICK-this.w/2);
      this.y=clamp(this.y, WALL_THICK+this.h/2, CANVAS_H-WALL_THICK-this.h/2);
      // trilha
      this.dashTrail.push({x:this.x,y:this.y,life:220});
      if(this.dashTrail.length>10) this.dashTrail.shift();
      // dano no jogador se encostar durante dash
      if(rectCollide(player.x-player.w/2,player.y-player.h/2,player.w,player.h, this.x-this.w/2,this.y-this.h/2,this.w,this.h)){
        if(!player.isInvulnerable() && this.canDamage()){
          if(player.takeDamage(MINIBOSS_DAMAGE)){
            if(particles) for(let k=0;k<10;k++) particles.push(new Particle(player.x,player.y, randRange(-2.5,2.5), randRange(-2.5,1), 320, '#d946ef',3));
          }
          this.resetDamageCooldown();
        }
      }
      // dano em outros inimigos? não
      if(this.dashTime<=0 || hitWall){
        this.isDashing=false;
        this.dashCooldown= 3800 + randRange(-400,500);
        this.dashPrep=0;
        // poeira ao parar (ou bater parede)
        if(particles) for(let k=0;k<12;k++) particles.push(new Particle(this.x,this.y, randRange(-2,2), randRange(-1.5,0.5), 300, hitWall?'#888':'#d946ef',2));
        if(hitWall && particles) for(let k=0;k<8;k++) particles.push(new Particle(this.x,this.y, randRange(-1.5,1.5), randRange(-1.2,0.4), 260, '#555',2));
      }
      // atualiza trilha life
      for(let i=this.dashTrail.length-1;i>=0;i--){ this.dashTrail[i].life-=dt; if(this.dashTrail[i].life<=0) this.dashTrail.splice(i,1); }
      return; // durante dash não ataca
    }
    if(this.dashPrep>0){
      this.dashPrep-=dt;
      this.prepIndicator= 1 - (this.dashPrep / MINIBOSS_DASH_PREP);
      if(this.dashPrep<=0){
        // inicia dash
        this.isDashing=true;
        this.dashTime=MINIBOSS_DASH_DURATION;
        this.dashTrail=[];
        // já tem dashDir definido
      }
      return;
    }
    // Preparação de ataque cruz/X
    if(this.isPrepping){
      this.prepTimer-=dt;
      this.prepIndicator= 1 - (this.prepTimer / 450);
      if(this.prepTimer<=0){
        // dispara padrão
        this.firePattern(this.prepPattern, bulletOut, particles);
        this.isPrepping=false;
        this.prepPattern=null;
        this.prepIndicator=0;
        // alterna padrão
        this.nextPattern = this.nextPattern==='cross' ? 'x' : 'cross';
        this.attackTimer = this.nextPattern==='cross' ? MINIBOSS_CROSS_COOLDOWN : MINIBOSS_X_COOLDOWN;
        // chance de dash após ataque
        if(this.dashCooldown<=0 && Math.random()<0.45){
          this.prepareDash(player);
        }
      }
      return;
    }
    // Cooldowns
    if(this.attackTimer>0) this.attackTimer-=dt;
    if(this.dashCooldown>0) this.dashCooldown-=dt;
    if(this.summonTimer>0 && this.phase2) this.summonTimer-=dt;

    // Fase 2 invocação
    if(this.phase2 && this.summonTimer<=0){
      // limpa mortos
      this.summons=this.summons.filter(e=>!e.dead && allEnemies.includes(e));
      if(this.summons.length < MINIBOSS_MAX_SUMMONS && allEnemies.length < 9){
        // posição próxima mas não em cima do jogador
        let sx,sy,tries=0;
        do{
          const ang=Math.random()*Math.PI*2, r=randRange(52,96);
          sx=this.x + Math.cos(ang)*r; sy=this.y + Math.sin(ang)*r;
          tries++;
          let onWall=false;
          for(const w of walls) if(rectCollide(sx-14,sy-14,28,28,w.x,w.y,w.w,w.h)) {onWall=true; break;}
          if(!onWall && dist(sx,sy,player.x,player.y)>70) break;
        }while(tries<14);
        const e=new Chaser(sx,sy);
        e.hp=2; e.maxHp=2; e.speed=ENEMY_SPEED*0.95; e.w=24; e.h=24;
        e.isSummoned=true;
        applyEnemyVariation(e, Math.random, 2);
        spawnList.push(e); this.summons.push(e);
        if(particles) for(let k=0;k<10;k++) particles.push(new Particle(sx,sy, randRange(-1.4,1.4), randRange(-1.4,0.6), 340, '#d946ef',2));
        this.summonTimer=MINIBOSS_SUMMON_COOLDOWN + randRange(-400,600);
      } else {
        this.summonTimer= 1200; // tenta de novo em breve
      }
    }

    // Decide próxima ação: ataque ou dash
    if(this.attackTimer<=0 && !this.isPrepping){
      this.isPrepping=true;
      this.prepPattern=this.nextPattern;
      this.prepTimer=450; // indicação visual
      this.prepIndicator=0;
      // som/efeito preparação
      if(particles) for(let k=0;k<4;k++) particles.push(new Particle(this.x,this.y, randRange(-0.8,0.8), randRange(-0.8,0.4), 220, this.prepPattern==='cross'?'#ff6b6b':'#ffd700',2));
      return;
    }
    if(this.dashCooldown<=0 && !this.isPrepping && Math.random()<0.008){
      this.prepareDash(player);
    }
    // Miniboss fica parado (controle de área) com leve flutuação
    this.x += Math.sin(this.anim*0.002)*0.18;
    this.y += Math.cos(this.anim*0.0018)*0.18;
    this.x=clamp(this.x, WALL_THICK+this.w/2, CANVAS_W-WALL_THICK-this.w/2);
    this.y=clamp(this.y, WALL_THICK+this.h/2, CANVAS_H-WALL_THICK-this.h/2);
  }
  prepareDash(player){
    const dir=normalize(player.x - this.x, player.y - this.y);
    this.dashDir=dir;
    this.dashPrep=MINIBOSS_DASH_PREP;
    this.prepIndicator=0;
    this.dashCooldown=999999; // trava até dash terminar, será resetado ao fim do dash
  }
  firePattern(pattern, bulletOut, particles){
    const cx=this.x, cy=this.y;
    let angles=[];
    if(pattern==='cross') angles=[0, Math.PI/2, Math.PI, -Math.PI/2];
    else angles=[Math.PI/4, 3*Math.PI/4, 5*Math.PI/4, 7*Math.PI/4];
    // Para cruz, 4 direções; para X, 4 diagonais. Adiciona variação leve?
    for(const ang of angles){
      const dx=Math.cos(ang), dy=Math.sin(ang);
      bulletOut.push(new Bullet(cx, cy, dx, dy, 'enemy', {
        speed: MINIBOSS_BULLET_SPEED,
        damage: MINIBOSS_DAMAGE,
        range: 520,
        size: MINIBOSS_BULLET_SIZE,
        color: pattern==='cross' ? '#ff6b6b' : '#ffd700',
        glow: pattern==='cross' ? 'rgba(255,60,60,0.28)' : 'rgba(255,215,0,0.28)'
      }));
      if(particles) for(let k=0;k<3;k++) particles.push(new Particle(cx+dx*12,cy+dy*12, dx*randRange(0.5,1.2), dy*randRange(0.5,1.2), 180, pattern==='cross'?'#ff6b6b':'#ffd700',1.5));
    }
    // vibração leve
    // game.shake será setado externamente? bulletOut não tem shake, mas Room pode setar via particles? deixamos para Game
  }
  draw(ctx){
    const x=this.x - this.w/2, y=this.y - this.h/2, bob=Math.sin(this.anim*0.007)*1.8;
    const isFlash=this.hitFlash>0 && Math.floor(this.hitFlash/40)%2===0;
    const phase2Glow=this.phase2 ? 0.22 + Math.sin(this.anim*0.014)*0.10 : 0;
    ctx.fillStyle='rgba(0,0,0,0.38)'; ctx.fillRect(x+3, y+this.h-2, this.w, 3);
    // aura fase 2
    if(this.phase2){
      ctx.fillStyle=`rgba(217,70,239,${0.14+phase2Glow})`;
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.95+Math.sin(this.anim*0.01)*3,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle=`rgba(217,70,239,0.32)`; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*1.05,0,Math.PI*2); ctx.stroke();
    }
    // trilha dash
    for(const t of this.dashTrail){
      const a=clamp(t.life/220,0,1);
      ctx.fillStyle=`rgba(217,70,239,${a*0.28})`;
      ctx.beginPath(); ctx.arc(t.x, t.y+bob, 6,0,Math.PI*2); ctx.fill();
    }
    // indicação dash preparação (seta)
    if(this.dashPrep>0){
      const p=this.prepIndicator;
      ctx.strokeStyle=`rgba(255,60,60,${0.45+p*0.35})`;
      ctx.lineWidth=2;
      ctx.setLineDash([6,4]);
      ctx.beginPath();
      ctx.moveTo(this.x, this.y+bob);
      ctx.lineTo(this.x + this.dashDir.x*90, this.y+bob + this.dashDir.y*90);
      ctx.stroke();
      ctx.setLineDash([]);
      // cabeça seta pulsante
      const ax=this.x + this.dashDir.x*(90+Math.sin(this.anim*0.02)*4);
      const ay=this.y+bob + this.dashDir.y*(90+Math.sin(this.anim*0.02)*4);
      ctx.fillStyle=`rgba(255,80,80,${0.85})`;
      ctx.beginPath();
      const ang=Math.atan2(this.dashDir.y, this.dashDir.x);
      ctx.moveTo(ax,ay);
      ctx.lineTo(ax - Math.cos(ang-Math.PI/6)*12, ay - Math.sin(ang-Math.PI/6)*12);
      ctx.lineTo(ax - Math.cos(ang+Math.PI/6)*12, ay - Math.sin(ang+Math.PI/6)*12);
      ctx.closePath(); ctx.fill();
      // ícone !
      ctx.fillStyle='#fff'; ctx.font='9px monospace'; ctx.textAlign='center';
      ctx.fillText('!', this.x, y-10+bob); ctx.textAlign='left';
    }
    // indicação cruz/X preparação (linhas)
    if(this.isPrepping){
      const p=this.prepIndicator;
      ctx.strokeStyle=this.prepPattern==='cross'?`rgba(255,60,60,${0.35+p*0.35})`:`rgba(255,215,0,${0.35+p*0.35})`;
      ctx.lineWidth=1.5;
      ctx.setLineDash([4,4]);
      if(this.prepPattern==='cross'){
        ctx.beginPath(); ctx.moveTo(this.x-70, this.y+bob); ctx.lineTo(this.x+70, this.y+bob); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(this.x, this.y+bob-70); ctx.lineTo(this.x, this.y+bob+70); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(this.x-52, this.y+bob-52); ctx.lineTo(this.x+52, this.y+bob+52); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(this.x+52, this.y+bob-52); ctx.lineTo(this.x-52, this.y+bob+52); ctx.stroke();
      }
      ctx.setLineDash([]);
      // texto padrão
      ctx.fillStyle=this.prepPattern==='cross'?'rgba(255,60,60,0.95)':'rgba(255,215,0,0.95)';
      ctx.font='6px "Press Start 2P"'; ctx.textAlign='center';
      ctx.fillText(this.prepPattern==='cross'?'CRUZ':'X', this.x, y-12+bob); ctx.textAlign='left';
    }
    // corpo miniboss - grande, imponente
    ctx.fillStyle=isFlash?'#fff': this.phase2?'#a21caf':'#6d28d9';
    ctx.fillRect(x+2, y+4+bob, this.w-4, this.h-8);
    ctx.fillStyle=isFlash?'#ffaaaa': this.phase2?'#701a75':'#3a1040';
    ctx.fillRect(x, y+6+bob, 4, this.h-12);
    ctx.fillRect(x+this.w-4, y+6+bob, 4, this.h-12);
    // ombreiras
    ctx.fillStyle=isFlash?'#e9d5ff': this.phase2?'#e879f9':'#8b5cf6';
    ctx.fillRect(x-2, y+8+bob, 6, 12);
    ctx.fillRect(x+this.w-4, y+8+bob, 6, 12);
    // cabeça / elmo
    ctx.fillStyle=isFlash?'#fff':'#1e0f2a';
    ctx.fillRect(x+8, y-2+bob, this.w-16, 10);
    ctx.fillStyle=isFlash?'#e9d5ff':'#d946ef';
    ctx.fillRect(x+10, y+2+bob, this.w-20, 2);
    // olhos
    ctx.fillStyle=this.phase2?'#ff0000':'#00ff88';
    ctx.fillRect(x+9, y+3+bob, 6,4);
    ctx.fillRect(x+this.w-15, y+3+bob, 6,4);
    ctx.fillStyle='#fff';
    ctx.fillRect(x+10, y+4+bob, 2,1);
    ctx.fillRect(x+this.w-14, y+4+bob, 2,1);
    // runa peito
    ctx.fillStyle= this.phase2?`rgba(255,0,80,${0.85+Math.sin(this.anim*0.02)*0.15})`:'rgba(255,215,0,0.9)';
    ctx.beginPath(); ctx.arc(this.x, y+12+bob, 5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#000'; ctx.font='6px monospace'; ctx.textAlign='center';
    ctx.fillText(this.phase2?'◆':'✦', this.x, y+14+bob); ctx.textAlign='left';
    // barra vida grande
    const hpPct=clamp(this.hp/this.maxHp,0,1);
    ctx.fillStyle='rgba(0,0,0,0.75)'; ctx.fillRect(x-6, y-12+bob, this.w+12, 6);
    ctx.fillStyle=hpPct>0.5?'#d946ef':hpPct>0.2?'#f97316':'#ef4444'; ctx.fillRect(x-6, y-12+bob, (this.w+12)*hpPct, 6);
    ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=1; ctx.strokeRect(x-6, y-12+bob, this.w+12, 6);
    // indicador fase 2
    if(this.phase2){
      ctx.fillStyle='#fff'; ctx.font='5px "Press Start 2P"'; ctx.textAlign='center';
      ctx.fillText('FÚRIA', this.x, y-18+bob); ctx.textAlign='left';
    }
    if(this.phaseFlash>0){
      ctx.fillStyle=`rgba(255,255,255,${clamp(this.phaseFlash/900,0,0.55)})`;
      ctx.fillRect(x-4, y-4+bob, this.w+8, this.h+8);
    }
  }
  getRect(){ return {x:this.x-this.w/2,y:this.y-this.h/2,w:this.w,h:this.h}; }
}

// ===================== INIMIGO DE INVESTIDA FASE 4 =====================
class DashEnemy {
  constructor(x,y){
    this.x=x; this.y=y;
    this.w=DASH_ENEMY_SIZE; this.h=DASH_ENEMY_SIZE;
    this.speed=DASH_ENEMY_SPEED;
    this._baseSpeed=DASH_ENEMY_SPEED;
    this.hp=DASH_ENEMY_HP; this.maxHp=DASH_ENEMY_HP;
    this.dead=false; this.hitFlash=0; this.anim=Math.random()*1000;
    this.type='dash';
    this.collisionDamage = DASH_ENEMY_DAMAGE;
    this.dashDamage = DASH_ENEMY_DAMAGE;
    this.variation = null;
    this.damageCooldown=0;
    this.state='idle'; // idle, charging, dashing, stunned
    this.chargeTimer=0;
    this.dashTimer=0;
    this.stunTimer=0;
    this.dashDir={x:0,y:0};
    this.detectRadius=DASH_ENEMY_DETECT_RADIUS;
    this.slowTimer=0; this.slowFactor=1; this.stunTimerStand=0; // reutiliza para stun da parede (stunTimer)
    // para compat com sistema geral stun: usamos stunTimer para Flecha e stunTimerStand? vamos unificar: stunTimer = stun Flecha, stunWall = stun parede
    this.wallStunTimer=0;
  }
  takeDamage(dmg){ this.hp-=dmg; this.hitFlash=150; if(this.hp<=0){this.dead=true; return true;} return false; }
  canDamage(){ return this.damageCooldown<=0; }
  resetDamageCooldown(){ this.damageCooldown=ENEMY_DAMAGE_COOLDOWN; }
  collidesWalls(nx,ny,walls){
    const hw=this.w/2, hh=this.h/2, rx=nx-hw, ry=ny-hh;
    for(const w of walls) if(rectCollide(rx,ry,this.w,this.h,w.x,w.y,w.w,w.h)) return true;
    return false;
  }
  update(dt, player, walls){
    this.anim+=dt;
    if(this.hitFlash>0) this.hitFlash-=dt;
    if(this.damageCooldown>0) this.damageCooldown-=dt;
    // Stun parede tem prioridade (fica atordoado)
    if(this.wallStunTimer>0){
      this.wallStunTimer-=dt;
      if(this.wallStunTimer<=0) {this.wallStunTimer=0; this.state='idle';}
      return;
    }
    // Flecha paralisia
    if(this.stunTimer>0){ this.stunTimer-=dt; if(this.stunTimer<=0) this.stunTimer=0; return; }
    let effSpeed=this._baseSpeed;
    if(this.slowTimer>0){ this.slowTimer-=dt; if(this.slowTimer<=0){this.slowTimer=0; this.slowFactor=1; this.speed=this._baseSpeed;} else effSpeed=this._baseSpeed*this.slowFactor; } else this.speed=this._baseSpeed;

    if(this.dead) return;
    const d=dist(this.x,this.y, player.x, player.y);

    if(this.state==='charging'){
      this.chargeTimer-=dt;
      if(this.chargeTimer<=0){
        // inicia dash
        const dir=normalize(player.x - this.x, player.y - this.y);
        this.dashDir=dir;
        this.state='dashing';
        this.dashTimer=DASH_ENEMY_DASH_DURATION;
      }
      return; // parado carregando
    }
    if(this.state==='dashing'){
      this.dashTimer-=dt;
      const nx=this.x + this.dashDir.x * DASH_ENEMY_DASH_SPEED;
      const ny=this.y + this.dashDir.y * DASH_ENEMY_DASH_SPEED;
      let hitWall=false;
      if(this.collidesWalls(nx, this.y, walls)) hitWall=true; else this.x=nx;
      if(this.collidesWalls(this.x, ny, walls)) hitWall=true; else this.y=ny;
      this.x=clamp(this.x, WALL_THICK+this.w/2, CANVAS_W-WALL_THICK-this.w/2);
      this.y=clamp(this.y, WALL_THICK+this.h/2, CANVAS_H-WALL_THICK-this.h/2);
      // colisão com jogador durante dash
      if(rectCollide(player.x-player.w/2,player.y-player.h/2,player.w,player.h, this.x-this.w/2, this.y-this.h/2, this.w,this.h)){
        if(!player.isInvulnerable() && this.canDamage()){
          const dashDmg = this.collisionDamage || this.dashDamage || DASH_ENEMY_DAMAGE;
          if(player.takeDamage(dashDmg)){
            // partículas
          }
          this.resetDamageCooldown();
        }
      }
      if(hitWall){
        // bateu na parede -> atordoado + rebote
        this.x -= this.dashDir.x * 14;
        this.y -= this.dashDir.y * 14;
        this.state='stunned';
        this.wallStunTimer=DASH_ENEMY_STUN_DURATION;
        this.dashTimer=0;
        // efeito
      } else if(this.dashTimer<=0){
        this.state='idle';
      }
      return;
    }
    if(this.state==='stunned'){
      // wallStunTimer já tratado no topo
      return;
    }
    // idle: detecta jogador
    if(d < this.detectRadius){
      this.state='charging';
      this.chargeTimer=DASH_ENEMY_CHARGE_TIME;
      // direção já será calculada no fim do charge (previsível, mostra linha)
      return;
    }
    // patrulha leve
    this.x += Math.sin(this.anim*0.003)*0.35 * (effSpeed/this._baseSpeed);
    this.y += Math.cos(this.anim*0.0025)*0.35 * (effSpeed/this._baseSpeed);
    this.x=clamp(this.x, WALL_THICK+this.w/2, CANVAS_W-WALL_THICK-this.w/2);
    this.y=clamp(this.y, WALL_THICK+this.h/2, CANVAS_H-WALL_THICK-this.h/2);
  }
  draw(ctx){
    const x=this.x - this.w/2, y=this.y - this.h/2, bob=Math.sin(this.anim*0.009)*1.4;
    const isFlash=this.hitFlash>0 && Math.floor(this.hitFlash/40)%2===0;
    const isStunnedWall=this.wallStunTimer>0;
    const isStunnedFlecha=this.stunTimer>0;
    const isSlowed=this.slowTimer>0;
    // aura status
    if(isStunnedWall || isStunnedFlecha){
      const pulse=0.5+Math.sin(this.anim*0.016)*0.32;
      ctx.fillStyle=`rgba(255,215,0,${0.16+pulse*0.10})`;
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.9+pulse*2,0,Math.PI*2); ctx.fill();
    } else if(isSlowed){
      ctx.fillStyle=`rgba(96,165,250,0.14)`;
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.85,0,Math.PI*2); ctx.fill();
    }
    drawVariationAura(ctx,this,bob);
    if(this.state==='charging'){
      const p=1 - (this.chargeTimer / DASH_ENEMY_CHARGE_TIME);
      ctx.strokeStyle=`rgba(255,60,60,${0.35+p*0.45})`;
      ctx.lineWidth=1.8;
      ctx.setLineDash([4,3]);
      ctx.beginPath();
      ctx.arc(this.x, this.y+bob, 12+p*10,0,Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
      // barra de carga sobre cabeça
      ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(x, y-8+bob, this.w, 3);
      ctx.fillStyle='#ff3b30'; ctx.fillRect(x, y-8+bob, this.w * p, 3);
    }
    ctx.fillStyle='rgba(0,0,0,0.32)'; ctx.fillRect(x+2, y+this.h-3, this.w, 3);
    // corpo
    let baseDash='#e85d04'; if(this.variation==='tank') baseDash='#2a5a8a'; else if(this.variation==='brute') baseDash='#8b1a10'; else if(this.variation==='elite') baseDash='#6d28d9';
    let col = isFlash ? '#ffaaaa' : isStunnedWall ? '#a1a1aa' : isStunnedFlecha ? '#a1a1aa' : isSlowed ? '#60a5fa' : this.state==='charging' ? '#ff6b35' : this.state==='dashing' ? '#ff3b30' : baseDash;
    ctx.fillStyle=col;
    ctx.fillRect(x+2, y+4+bob, this.w-4, this.h-8);
    // chifres / capacete investida
    ctx.fillStyle=isStunnedWall?'#6b7280': isFlash?'#fff':'#3a1a00';
    ctx.fillRect(x+4, y+1+bob, 4, 6);
    ctx.fillRect(x+this.w-8, y+1+bob, 4, 6);
    if(this.state==='charging'){
      ctx.fillStyle=`rgba(255,60,60,${0.55+Math.sin(this.anim*0.02)*0.25})`;
      ctx.fillRect(x+6, y+6+bob, this.w-12, 3);
    }
    if(this.state==='dashing'){
      // rastro
      ctx.fillStyle='rgba(255,60,60,0.18)';
      ctx.fillRect(x- this.dashDir.x*8, y+6+bob - this.dashDir.y*8, this.w-4, 6);
    }
    // olhos
    ctx.fillStyle=isStunnedWall?'#ffd700': isFlash?'#fff':'#1a0000';
    ctx.fillRect(x+6, y+9+bob, 5,3);
    ctx.fillRect(x+15, y+9+bob, 5,3);
    ctx.fillStyle=isStunnedWall?'#000':'#fff';
    if(isStunnedWall){
      // X nos olhos
      ctx.fillStyle='#000'; ctx.font='6px monospace'; ctx.textAlign='center';
      ctx.fillText('x', x+8, y+12+bob); ctx.fillText('x', x+17, y+12+bob); ctx.textAlign='left';
      // estrelas
      ctx.fillStyle='#ffd700'; ctx.font='7px monospace'; ctx.textAlign='center';
      ctx.fillText('★', this.x, y-6+bob); ctx.textAlign='left';
    } else {
      ctx.fillStyle='#ffeb3b'; ctx.fillRect(x+7, y+10+bob, 2,1); ctx.fillRect(x+16, y+10+bob, 2,1);
    }
    // barra vida
    if(this.hp < this.maxHp){
      const pct=clamp(this.hp/this.maxHp,0,1);
      ctx.fillStyle='rgba(0,0,0,0.70)'; ctx.fillRect(x, y-6+bob, this.w,4);
      ctx.fillStyle=pct>0.5?'#f97316':'#ef4444'; ctx.fillRect(x, y-6+bob, this.w*pct,4);
    }
    drawVariationIcon(ctx,this,x,y,bob);
    // indicador stun
    if(isStunnedWall){
      ctx.strokeStyle='rgba(255,215,0,0.55)'; ctx.lineWidth=1.2;
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.82,0,Math.PI*2); ctx.stroke();
    }
  }
  getRect(){ return {x:this.x-this.w/2,y:this.y-this.h/2,w:this.w,h:this.h}; }
}

// ===================== BOSS FASE 5 - MÃO (BossHand) =====================
// Mão do boss da escada: versão épica com slam direcionado, shockwave, janela de vulnerabilidade e adaptação.
// Mantém compatibilidade mas adiciona mecânicas justas: alvo telegrafado, punição a camping e janela clara para contra-ataque.
class BossHand {
  constructor(x, y, side){
    this.x=x; this.y=y;
    this.side=side; // 'left' ou 'right'
    this.w=BOSS5_HAND_SIZE; this.h=BOSS5_HAND_SIZE;
    this.hp=BOSS5_HAND_HP; this.maxHp=BOSS5_HAND_HP;
    this.dead=false; this.hitFlash=0; this.anim=Math.random()*1000;
    this.baseX=x; this.baseY=y;
    this.slamTimer= (BOSS5_HAND_SLAM_INTERVAL_P1 || BOSS5_HAND_SLAM_INTERVAL) + randRange(-400,500) + (side==='left'?0:900); // alterna
    this.isSlamming=false; this.slamProgress=0; // 0..1 (descida e subida)
    this.slamDuration= BOSS5_HAND_SLAM_DUR;
    this.slamCooldown=0;
    this.yOffset=0;
    this.xOffset=0; // desvio horizontal quando mira no jogador (adaptação)
    this.targetX=null; this.targetY=null; // alvo do slam atual (null = segue boss)
    this.isDoubleSlam=false; // true quando ambas batem juntas (fase2/3)
    this.groundedTimer=0; // janela após bater onde fica vulnerável (+55% dano)
    this.groundedVuln=0; // >0 indica que está no chão vulnerável
    this.stunTimer=0;
    this.slowTimer=0; this.slowFactor=1;
    this.damageCooldown=0;
    this.invulnerable=false;
    this.slamPattern='radial'; // radial, spiral, aimed
    this.slamSpeedFactor=1; // escala com fase/enrage
  }
  takeDamage(dmg){
    if(this.invulnerable) return false;
    if(this.dead) return false;
    // Janela de punição: se recém bateu e está no chão, toma dano bônus (recompensa posicionamento)
    let finalDmg = dmg;
    if(this.groundedVuln>0) finalDmg = dmg * BOSS5_SPOTLIGHT_DMG_BONUS;
    this.hp-=finalDmg; this.hitFlash=140;
    if(this.hp<=0){ this.dead=true; this.hp=0; this.groundedVuln=0; return true; }
    return false;
  }
  canDamage(){ return this.damageCooldown<=0 && !this.dead; }
  resetDamageCooldown(){ this.damageCooldown=900; }
  // Inicia slam com alvo opcional (para adaptação). Chamado pelo boss.
  startSlam(opts={}){
    if(this.dead || this.isSlamming) return false;
    this.isSlamming=true; this.slamProgress=0; this.yOffset=0; this.xOffset=0;
    this.targetX = opts.targetX ?? null;
    this.targetY = opts.targetY ?? null;
    this.isDoubleSlam = !!opts.isDouble;
    this.slamPattern = opts.pattern || 'radial';
    this.slamDuration = opts.duration || BOSS5_HAND_SLAM_DUR;
    // Se alvo existe, calcula offset inicial para interpolação durante descida
    if(this.targetX!==null){
      // limita desvio para não sair da arena (evita punir injustamente)
      this.targetX = clamp(this.targetX, WALL_THICK+28, CANVAS_W-WALL_THICK-28);
      this.targetY = clamp(this.targetY, BOSS5_ARENA_Y+34, CANVAS_H-WALL_THICK-42);
    }
    return true;
  }
  // Atualiza: agora suporta slam direcionado e shockwave via room
  update(dt, bossX, bossY, player, bulletOut, particles, room){
    this.anim+=dt;
    if(this.hitFlash>0) this.hitFlash-=dt;
    if(this.damageCooldown>0) this.damageCooldown-=dt;
    if(this.groundedVuln>0){ this.groundedVuln-=dt; if(this.groundedVuln<=0) this.groundedVuln=0; }
    if(this.groundedTimer>0) this.groundedTimer-=dt;
    if(this.stunTimer>0){ this.stunTimer-=dt; if(this.stunTimer<=0) this.stunTimer=0; return; }
    if(this.dead) return;
    // Posição base segue bossX/Y com offset (com lag suave)
    const homeX = bossX + (this.side==='left' ? -BOSS5_HAND_OFFSET_X : BOSS5_HAND_OFFSET_X);
    const homeY = bossY + BOSS5_HAND_OFFSET_Y;
    this.baseX = lerp(this.baseX, homeX, 0.13);
    this.baseY = lerp(this.baseY, homeY, 0.13);

    if(this.isSlamming){
      this.slamProgress += dt / this.slamDuration;
      // Interpola X em direção ao alvo durante descida (telegrafado visualmente)
      let curTargetX = this.targetX!==null ? this.targetX : this.baseX;
      let curTargetY = this.targetY!==null ? this.targetY : this.baseY;
      const horizLerp = clamp(this.slamProgress*1.6,0,1);
      const interpX = lerp(this.baseX, curTargetX, horizLerp*0.85);
      // Y: descida acelerada + subida desacelerada
      if(this.slamProgress < 0.5){
        const t = this.slamProgress*2;
        this.yOffset = lerp(0, 62, t*t);
        this.x = interpX;
        this.y = this.baseY + this.yOffset;
        // Ao atingir 45-55% cria sombra telegrafada já (draw faz)
      } else if(this.slamProgress < 1.0){
        const t = (this.slamProgress-0.5)*2;
        this.yOffset = lerp(62, 0, Math.sqrt(t));
        this.x = lerp(interpX, this.baseX, t*0.45);
        this.y = this.baseY + this.yOffset;
      } else {
        // Fim do slam: volta à base
        this.isSlamming=false;
        this.slamProgress=0;
        this.yOffset=0; this.xOffset=0;
        this.x = this.baseX; this.y=this.baseY;
        this.targetX=null; this.targetY=null;
        // Janela vulnerável no chão: 420ms onde toma +55% dano e brilha
        this.groundedVuln = 420;
        this.groundedTimer = 220;
        // Configura timer de próximo slam baseado na fase atual do boss (boss controla mas fallback)
        const phaseInterval = this._phaseInterval || BOSS5_HAND_SLAM_INTERVAL_P1;
        this.slamCooldown = phaseInterval;
        this.slamTimer = this.slamCooldown + randRange(-280,380);
        // Lança padrão correspondente
        const cx=this.x, cy=this.y+8;
        const speedFactor = this.slamSpeedFactor || 1;
        const projSpeed = BOSS5_PROJECTILE_SPEED * (this.isDoubleSlam?1.08:1) * speedFactor;
        const isDouble = this.isDoubleSlam;
        if(this.slamPattern==='spiral'){
          // Espiral: 10 projéteis com offset baseado no lado e tempo
          const baseAng = (this.side==='left'?0:Math.PI/9) + this.anim*0.001;
          for(let i=0;i<BOSS5_SPIRAL_COUNT;i++){
            const ang= baseAng + (i/BOSS5_SPIRAL_COUNT)*Math.PI*2;
            const dx=Math.cos(ang), dy=Math.sin(ang);
            bulletOut.push(new Bullet(cx, cy, dx, dy, 'enemy', {
              speed: projSpeed*0.96,
              damage: BOSS5_PROJECTILE_DAMAGE,
              range: 520,
              size: BOSS5_PROJECTILE_SIZE,
              color: isDouble?'#ff3b30':'#c084fc',
              glow: isDouble?'rgba(255,59,48,0.34)':'rgba(192,132,252,0.32)'
            }));
          }
        } else if(this.slamPattern==='aimed'){
          // Tiro mirado: 3 projéteis em leque na direção do jogador
          const angToPlayer = Math.atan2(player.y - cy, player.x - cx);
          for(let o=-1;o<=1;o++){
            const ang = angToPlayer + o*0.28;
            const dx=Math.cos(ang), dy=Math.sin(ang);
            bulletOut.push(new Bullet(cx, cy, dx, dy, 'enemy', {
              speed: projSpeed*1.12,
              damage: BOSS5_PROJECTILE_DAMAGE,
              range: 520,
              size: BOSS5_PROJECTILE_SIZE,
              color: '#ffd700',
              glow: 'rgba(255,215,0,0.32)'
            }));
          }
          // + 2 radiais laterais para não ser só mirado
          for(let k=0;k<2;k++){
            const ang = angToPlayer + Math.PI + (k===0?-0.4:0.4);
            bulletOut.push(new Bullet(cx, cy, Math.cos(ang), Math.sin(ang), 'enemy', {
              speed: projSpeed*0.9, damage: BOSS5_PROJECTILE_DAMAGE, range: 460, size: BOSS5_PROJECTILE_SIZE, color:'#ff8c42', glow:'rgba(255,140,66,0.28)'
            }));
          }
        } else {
          // Radial padrão 8 direções (ou 12 se double)
          const count = isDouble?12:8;
          for(let i=0;i<count;i++){
            const ang=(i/count)*Math.PI*2 + (isDouble?Math.PI/count:0);
            const dx=Math.cos(ang), dy=Math.sin(ang);
            bulletOut.push(new Bullet(cx, cy, dx, dy, 'enemy', {
              speed: projSpeed,
              damage: BOSS5_PROJECTILE_DAMAGE,
              range: 520,
              size: BOSS5_PROJECTILE_SIZE,
              color: isDouble?'#ff3b30':'#ff8c42',
              glow: isDouble?'rgba(255,59,48,0.36)':'rgba(255,140,66,0.32)'
            }));
            if(particles) for(let kk=0;kk<(isDouble?1:2);kk++) particles.push(new Particle(cx+dx*6,cy+dy*6, dx*randRange(0.5,1.0), dy*randRange(0.5,1.0), 180, isDouble?'#ff3b30':'#ff8c42', 1.5));
          }
        }
        // Shockwave: cria anel expansivo (usando room.explosions com isShockwave)
        if(room && room.explosions){
          room.explosions.push({x:cx, y:cy+10, radius:10, life: isDouble?520:420, max: isDouble?520:420, isShockwave:true, isDouble:isDouble, ownerHand:this.side});
        }
        if(particles){
          for(let k=0;k<(isDouble?26:18);k++){ const ang=Math.random()*Math.PI*2; particles.push(new Particle(cx,cy+10, Math.cos(ang)*randRange(1.2,4.0), Math.sin(ang)*randRange(0.6,2.4), 340, isDouble?'#ff3b30':'#ff6a00', 2.2)); }
          for(let k=0;k<10;k++) particles.push(new Particle(cx,cy+10, randRange(-1.2,1.2), randRange(-1.5,-0.4), 260, '#ffd700', 2));
          if(isDouble) for(let k=0;k<12;k++) particles.push(new Particle(cx,cy+10, randRange(-1.4,1.4), randRange(-1.2,0.3), 300, '#ffffff', 1.8));
        }
        this.isDoubleSlam=false;
      }
      return;
    }

    // Não slamming: posição interpola para base
    this.x = this.baseX;
    this.y = this.baseY + this.yOffset;
    // Hand não inicia slam sozinha quando boss está em controle de fase 2/3 com double slam;
    // boss controla via startSlam(). Mantemos fallback timer apenas para fase1 livre.
    if(this.slamTimer>0) this.slamTimer-=dt;
    // Fallback apenas se boss não estiver em modo manual (detecta se slamTimer expirou e não é double pending)
    // Para compat, se boss não chamou startSlam, hand auto-inicia mas só em fase1
    // O boss irá resetar slamTimer ao entrar em fases, então este auto-início será suprimido em P2/P3
    if(this.slamTimer<=0 && !this.isSlamming && !this._manualControl){
      // Inicia batida simples radial no alvo atual (segue boss)
      this.startSlam({pattern:'radial', duration:BOSS5_HAND_SLAM_DUR});
    }

    // Flutuação leve
    this.y += Math.sin(this.anim*0.004 + (this.side==='left'?0:1.5))*0.42;
  }
  draw(ctx){
    if(this.dead){
      // Mão destruída: desenho rachada/fumaça
      const x=this.x - this.w/2, y=this.y - this.h/2, bob=Math.sin(this.anim*0.006)*1.2;
      ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.fillRect(x+2, y+this.h-3, this.w, 3);
      ctx.fillStyle='rgba(80,40,20,0.55)';
      ctx.fillRect(x+3, y+6+bob, this.w-6, this.h-10);
      // rachaduras
      ctx.strokeStyle='rgba(0,0,0,0.65)'; ctx.lineWidth=1.2;
      ctx.beginPath(); ctx.moveTo(x+6, y+8+bob); ctx.lineTo(x+this.w-6, y+14+bob); ctx.moveTo(x+8, y+18+bob); ctx.lineTo(x+this.w-8, y+10+bob); ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,0.14)';
      ctx.fillRect(x+6, y+8+bob, this.w-12, 2);
      // fumaça se acabou de morrer
      if(Math.random()<0.22){
        ctx.fillStyle='rgba(100,80,60,0.65)'; ctx.fillRect(x+this.w/2-1+randRange(-3,3), y-2+bob, 2, 2);
      }
      // X
      ctx.fillStyle='#ff3b30'; ctx.font='9px monospace'; ctx.textAlign='center';
      ctx.fillText('X', this.x, y+4+bob); ctx.textAlign='left';
      // barra vida vazia
      ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(x, y-7+bob, this.w, 4);
      ctx.fillStyle='#333'; ctx.fillRect(x, y-7+bob, this.w, 4);
      return;
    }
    const x=this.x - this.w/2, y=this.y - this.h/2, bob=this.isSlamming?0:Math.sin(this.anim*0.008)*1.4;
    const isFlash=this.hitFlash>0 && Math.floor(this.hitFlash/42)%2===0;
    // Aura invulnerável (fase 1 mãos são invulneráveis)
    if(this.invulnerable){
      const pulse=0.5+Math.sin(this.anim*0.012)*0.28;
      ctx.fillStyle=`rgba(120,120,130,${0.10+pulse*0.06})`;
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.88+2,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle=`rgba(180,180,190,${0.28})`; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.88,0,Math.PI*2); ctx.stroke();
    } else {
      // Aura vulnerável dourada
      const pulse=0.5+Math.sin(this.anim*0.014)*0.28;
      ctx.fillStyle=`rgba(255,215,0,${0.14+pulse*0.08})`;
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.90+pulse*2,0,Math.PI*2); ctx.fill();
    }
    ctx.fillStyle='rgba(0,0,0,0.30)'; ctx.fillRect(x+2, y+this.h-3, this.w, 3);
    // Sombra da batida no chão quando descendo
    if(this.isSlamming && this.slamProgress>0.25 && this.slamProgress<0.75){
      ctx.fillStyle='rgba(255,60,0,0.22)';
      ctx.beginPath(); ctx.ellipse(this.x, this.y+18, 18 + (1-this.slamProgress)*8, 6, 0,0,Math.PI*2); ctx.fill();
    }
    // Corpo da mão
    ctx.fillStyle=isFlash?'#ffaaaa': this.invulnerable?'#8a8a94':'#d4a574';
    ctx.fillRect(x+2, y+6+bob, this.w-4, this.h-10);
    // Dedos
    ctx.fillStyle=isFlash?'#ffcccc': this.invulnerable?'#a1a1aa':'#b8936a';
    for(let i=0;i<4;i++){
      const fx = x+4 + i*7;
      const fy = y+2+bob;
      const fingerH = this.isSlamming ? 8 + this.yOffset*0.08 : 6;
      ctx.fillRect(fx, fy, 5, fingerH);
      ctx.fillStyle=isFlash?'#fff':'#e8d5b5';
      ctx.fillRect(fx+1, fy, 3, 1.5);
      ctx.fillStyle=isFlash?'#ffaaaa': this.invulnerable?'#a1a1aa':'#b8936a';
    }
    // Palma / junta
    ctx.fillStyle=isFlash?'#ffdddd': this.invulnerable?'#9a9aa0':'#8b5a2b';
    ctx.fillRect(x+6, y+10+bob, this.w-12, 8);
    // Unhas
    ctx.fillStyle=isFlash?'#fff':'#ffd700';
    for(let i=0;i<4;i++){
      const fx=x+5 + i*7;
      ctx.fillRect(fx, y+2+bob, 3, 2);
    }
    // Pulso
    ctx.fillStyle=isFlash?'#ffaaaa': this.invulnerable?'#7a7a84':'#6b4a2d';
    ctx.fillRect(x+8, y+this.h-6+bob, this.w-16, 4);
    // Indicador slam: sombra laranja quando prestes a bater (telegrafia clara, 600ms)
    if(this.slamTimer < 600 && !this.isSlamming){
      const p=1 - (this.slamTimer/600);
      ctx.fillStyle=`rgba(255,80,0,${0.22+p*0.28})`;
      ctx.beginPath(); ctx.arc(this.x, this.y+10+bob, 4+p*6,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=`rgba(255,255,255,${0.55+p*0.35})`;
      ctx.font='6px monospace'; ctx.textAlign='center';
      ctx.fillText('!', this.x, y-8+bob); ctx.textAlign='left';
      // Alvo direcionado: linha tracejada até alvo quando vai mirar no jogador (fase2+)
      if(this.targetX!==null && this.slamTimer < 500){
        ctx.strokeStyle=`rgba(255,80,0,${0.35+p*0.35})`;
        ctx.lineWidth=1.2; ctx.setLineDash([4,3]);
        ctx.beginPath(); ctx.moveTo(this.x, this.y+bob); ctx.lineTo(this.targetX, this.targetY); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle=`rgba(255,80,0,${0.55+p*0.25})`;
        ctx.beginPath(); ctx.arc(this.targetX, this.targetY, 8+ p*4,0,Math.PI*2); ctx.strokeStyle=`rgba(255,80,0,${0.75})`; ctx.lineWidth=1; ctx.stroke();
        ctx.fillStyle='rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(this.targetX, this.targetY, 2,0,Math.PI*2); ctx.fill();
      }
    }
    // Janela de vulnerabilidade no chão: brilho dourado pulsante + texto
    if(this.groundedVuln>0 && !this.invulnerable){
      const p= clamp(this.groundedVuln/420,0,1);
      ctx.strokeStyle=`rgba(255,215,0,${0.55 + p*0.25})`;
      ctx.lineWidth=2; ctx.setLineDash([5,3]);
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.92 + (1-p)*6,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle=`rgba(255,215,0,${0.18 + p*0.12})`;
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.90,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=`rgba(255,255,255,${0.75 + p*0.2})`;
      ctx.font='5px monospace'; ctx.textAlign='center';
      ctx.fillText('VULNERÁVEL', this.x, y-14+bob); ctx.textAlign='left';
    }
    // Double slam indicator quando ambas vão bater
    if(this.isDoubleSlam && this.isSlamming && this.slamProgress<0.25){
      ctx.fillStyle=`rgba(255,59,48,${0.35+ Math.sin(this.anim*0.02)*0.2})`;
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, 6,0,Math.PI*2); ctx.fill();
    }
    // Barra vida mãos (só mostra se vulnerável ou danificada)
    if(!this.invulnerable || this.hp < this.maxHp){
      const pct=clamp(this.hp/this.maxHp,0,1);
      ctx.fillStyle='rgba(0,0,0,0.70)'; ctx.fillRect(x, y-8+bob, this.w, 4);
      ctx.fillStyle=pct>0.5?'#ffd700':pct>0.25?'#ff8c42':'#ef4444'; ctx.fillRect(x, y-8+bob, this.w*pct, 4);
      ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=1; ctx.strokeRect(x, y-8+bob, this.w, 4);
      // texto vida
      ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.font='4px monospace'; ctx.textAlign='center';
      ctx.fillText(`${Math.ceil(this.hp)}/${this.maxHp}`, this.x, y-10+bob); ctx.textAlign='left';
      if(this.invulnerable){
        ctx.fillStyle='rgba(200,200,210,0.85)'; ctx.font='4px monospace'; ctx.textAlign='center';
        ctx.fillText('BLOQ', this.x, y-16+bob); ctx.textAlign='left';
      }
    }
  }
  getRect(){ return {x:this.x-this.w/2,y:this.y-this.h/2,w:this.w,h:this.h}; }
  // Retorna true se a mão está no chão (para dano em área)
  isOnGround(){ return this.isSlamming && this.slamProgress>=0.48 && this.slamProgress<=0.56; }
}
// ===================== BOSS FASE 5 - STAIR BOSS (Cabeça + 2 Mãos) =====================
// Boss épico 3 fases com adaptação, combos, shockwave, raio telegrafado e janelas curtas mas claras.
// Fase 1 (100-64%): ensina padrões básicos, cabeça vulnerável, mãos BLOQ. Ritmo moderado.
// Fase 2 (64-34%): cabeça BLOQUEADA, mãos vulneráveis, ataques direcionados + meteoro. Requer destruir mãos.
// Fase 3 (34-0%): modo desespero, janelas curtas (1.35s) após Double Slam, todos ataques rápidos + combos + sweep/dash.
// Adaptação: pune camping (ficar parado), ficar no mesmo quadrante e repetição de dash. Escalada gradual 0-22% ao longo de 70s.
class StairBoss {
  constructor(x, y){
    this.x=x; this.y=y;
    this.baseY=y;
    this.w=BOSS5_SIZE; this.h=BOSS5_SIZE;
    this.hp=BOSS5_HP; this.maxHp=BOSS5_HP;
    this.dead=false; this.hitFlash=0; this.anim=0;
    this.type='stair_boss';
    this.damageCooldown=0;
    this.dir=1;
    this.phase=1;
    this.moveSpeed=BOSS5_MOVE_SPEED_P1;
    this.battleTime=0; this.enrage=0;
    this.leftHand=new BossHand(x - BOSS5_HAND_OFFSET_X, y + BOSS5_HAND_OFFSET_Y, 'left');
    this.rightHand=new BossHand(x + BOSS5_HAND_OFFSET_X, y + BOSS5_HAND_OFFSET_Y, 'right');
    this.headInvulnerable=false;
    this.leftHand.invulnerable=true;
    this.rightHand.invulnerable=true;
    this.phase2Triggered=false;
    this.phase3Triggered=false;
    // Timers faseados
    this.summonTimer=BOSS5_SUMMON_COOLDOWN_P1 + randRange(-500,600);
    this.rayTimer=BOSS5_RAY_COOLDOWN_P1 + randRange(-700,900);
    this.rayWarning=0; this.isRayWarning=false; this.rayTarget=null; this.rayMode='center'; this.rayDuration=0; this.isRayActive=false; this.rayHitCooldown=0; this.sweepProgress=0; this.sweepDir=1;
    this.doubleSlamTimer= BOSS5_DOUBLE_SLAM_COOLDOWN + randRange(-400,600);
    this.meteorTimer= BOSS5_METEOR_COOLDOWN_P2 + randRange(-600,800);
    this.meteors=[]; // {x,y, warnTimer, hasWarned, radius}
    this.dashPrep=0; this.isDashing=false; this.dashDir={x:0,y:0}; this.dashTime=0; this.dashCooldown= BOSS5_DASH_COOLDOWN + randRange(-800,900); this.dashTrail=[];
    this.vulnWindow=0; this.vulnCooldown= 1100; // phase3 janela
    this.spiralTimer= BOSS5_SPIRAL_COOLDOWN + randRange(-400,500);
    this.comboDelay=0;
    this.victoryTimer=0;
    this.summoned=[];
    this.rayHitCooldown=0;
    // Adaptação
    this.adapt={ stationaryTime:0, lastPos:{x:x, y:y}, quadTimes:[0,0,0,0], dashTimes:[], dashLast:0, avgDist:220, campNotified:false };
    this._handPhaseInterval = BOSS5_HAND_SLAM_INTERVAL_P1;
    this.updateHandManualFlags();
    this.updateHandPhaseParams();
  }
  updateHandManualFlags(){
    const manual = this.phase>=2;
    this.leftHand._manualControl = manual;
    this.rightHand._manualControl = manual;
  }
  updateHandPhaseParams(){
    let interval, speedFactor;
    if(this.phase===1){ interval=BOSS5_HAND_SLAM_INTERVAL_P1; speedFactor=1.0; this.moveSpeed = BOSS5_MOVE_SPEED_P1 * (1+this.enrage*0.55); }
    else if(this.phase===2){ interval=BOSS5_HAND_SLAM_INTERVAL_P2; speedFactor=1.12; this.moveSpeed = BOSS5_MOVE_SPEED_P2 * (1+this.enrage*0.48); }
    else { interval=BOSS5_HAND_SLAM_INTERVAL_P3; speedFactor=1.24; this.moveSpeed = BOSS5_MOVE_SPEED_P3 * (1+this.enrage*0.42); }
    this._handPhaseInterval = interval * (1 - this.enrage*0.18);
    this.leftHand._phaseInterval = this._handPhaseInterval;
    this.rightHand._phaseInterval = this._handPhaseInterval;
    this.leftHand.slamSpeedFactor = speedFactor;
    this.rightHand.slamSpeedFactor = speedFactor;
    // Atualiza timers existentes ligeiro ajust caso estejam muito longos
    const clampTimer = (t, cap) => Math.min(t, cap);
    this.leftHand.slamTimer = clampTimer(this.leftHand.slamTimer, this._handPhaseInterval+400);
    this.rightHand.slamTimer = clampTimer(this.rightHand.slamTimer, this._handPhaseInterval+900);
  }
  takeDamage(dmg){
    if(this.dead) return false;
    // Fase 2 bloqueia cabeça totalmente
    if(this.phase===2 && this.headInvulnerable) return false;
    // Fase 3: fora da janela, dano reduzido mas não zero (justo: permite chip mas incentiva janela)
    let finalDmg = dmg;
    if(this.phase===3 && this.headInvulnerable){
      if(this.vulnWindow>0){
        finalDmg = dmg; // janela dourada: dano total
      } else {
        // shielded: chip damage 28% + efeito de faísca
        finalDmg = dmg * BOSS5_VULN_SHIELDED_DMG_FACTOR;
        // não bloqueia totalmente para não frustrar, mas punir spam fora da janela
        if(finalDmg < 0.22) finalDmg = 0.22;
      }
    } else if(this.headInvulnerable){
      return false;
    }
    this.hp-=finalDmg; this.hitFlash=140;
    if(this.hp<=0){ this.hp=0; this.dead=true; this.victoryTimer=0; return true; }
    this.checkPhase();
    return false;
  }
  checkPhase(){
    if(this.phase===1 && this.hp <= this.maxHp*BOSS5_PHASE2_AT){
      this.enterPhase2();
    } else if(this.phase===2 && this.hp <= this.maxHp*BOSS5_PHASE3_AT){
      this.enterPhase3();
    } else if(this.phase===2 && this.leftHand.dead && this.rightHand.dead && this.hp <= this.maxHp*0.48){
      // Se jogador destruiu mãos muito cedo, antecipa fase3 para manter ritmo épico
      if(this.hp > this.maxHp*BOSS5_PHASE3_AT){
        this.hp = this.maxHp*BOSS5_PHASE3_AT; // ajusta para threshold para não ficar muito tempo sem pressão
      }
      this.enterPhase3();
    }
  }
  enterPhase2(){
    if(this.phase2Triggered) return;
    this.phase2Triggered=true; this.phase=2;
    this.headInvulnerable=true;
    this.leftHand.invulnerable=false;
    this.rightHand.invulnerable=false;
    if(this.leftHand.dead){ this.leftHand.dead=false; this.leftHand.hp=this.leftHand.maxHp*0.62; }
    if(this.rightHand.dead){ this.rightHand.dead=false; this.rightHand.hp=this.rightHand.maxHp*0.62; }
    // Restaura vida mãos levemente se já danificadas mas vivas
    this.leftHand.hp = Math.max(this.leftHand.hp, this.leftHand.maxHp*0.78);
    this.rightHand.hp = Math.max(this.rightHand.hp, this.rightHand.maxHp*0.78);
    this.rayTimer = BOSS5_RAY_COOLDOWN_P2 * 0.65;
    this.doubleSlamTimer = BOSS5_DOUBLE_SLAM_COOLDOWN * 0.55;
    this.meteorTimer = BOSS5_METEOR_COOLDOWN_P2 * 0.6;
    this.summonTimer = BOSS5_SUMMON_COOLDOWN_P2 * 0.7;
    this.spiralTimer = BOSS5_SPIRAL_COOLDOWN * 0.6;
    this.updateHandManualFlags();
    this.updateHandPhaseParams();
    // efeito visual já será feito no update (partículas)
    this.hitFlash = 260;
  }
  enterPhase3(){
    if(this.phase3Triggered) return;
    this.phase3Triggered=true; this.phase=3;
    // Fase3: cabeça volta a ficar vulnerável apenas em janelas curtas após double slam
    // Inicialmente shielded, mas abre janela em breve via double slam
    this.headInvulnerable=true; // começa shielded, primeira janela vem rápido
    this.vulnWindow=0; this.vulnCooldown= 650; // abre janela em 0.65s via próximo double slam
    // Mãos ressuscitam com 55% se estavam mortas para manter pressão final (evita fase vazia)
    let anyRevived=false;
    if(this.leftHand.dead){ this.leftHand.dead=false; this.leftHand.hp=this.leftHand.maxHp*0.55; anyRevived=true; }
    if(this.rightHand.dead){ this.rightHand.dead=false; this.rightHand.hp=this.rightHand.maxHp*0.55; anyRevived=true; }
    this.leftHand.invulnerable=false; this.rightHand.invulnerable=false;
    this.rayTimer = BOSS5_RAY_COOLDOWN_P3 * 0.55;
    this.doubleSlamTimer = 1100; // double rápido para abrir janela
    this.meteorTimer = BOSS5_METEOR_COOLDOWN_P3 * 0.55;
    this.summonTimer = BOSS5_SUMMON_COOLDOWN_P3 * 0.6;
    this.spiralTimer = 900;
    this.dashCooldown = 2400;
    this.updateHandManualFlags();
    this.updateHandPhaseParams();
    this.hitFlash = 320;
  }
  checkPhaseEnd(){
    if(this.phase===2 && this.headInvulnerable && this.leftHand.dead && this.rightHand.dead){
      this.headInvulnerable=false;
      // Transição visual + shake será feita no update, mas pode antecipar fase3 se HP já baixo
      if(this.hp <= this.maxHp*0.46 && !this.phase3Triggered){
        this.enterPhase3();
        return false;
      }
      return true;
    }
    return false;
  }
  canDamage(){ return this.damageCooldown<=0; }
  resetDamageCooldown(){ this.damageCooldown=820; }
  collidesWalls(nx,ny,walls){
    const hw=this.w/2, hh=this.h/2, rx=nx-hw, ry=ny-hh;
    for(const w of walls) if(rectCollide(rx,ry,this.w,this.h,w.x,w.y,w.w,w.h)) return true;
    return false;
  }
  // Adaptação: rastreia camping, quadrante, dash repetitivo e distância média
  updateAdaptation(dt, player){
    const dx = player.x - this.adapt.lastPos.x, dy = player.y - this.adapt.lastPos.y;
    const moved = Math.hypot(dx, dy);
    if(moved < 5.5){
      this.adapt.stationaryTime += dt;
    } else {
      this.adapt.stationaryTime = Math.max(0, this.adapt.stationaryTime - dt*1.4);
    }
    this.adapt.lastPos.x = player.x; this.adapt.lastPos.y = player.y;
    // Quadrante
    const qx = player.x < CANVAS_W/2 ? 0 : 1;
    const qy = player.y < CANVAS_H/2 ? 0 : 2;
    const quad = qx + qy; // 0..3 (0 TL,1 TR,2 BL,3 BR) -> mapeia: qx(0/1)+ qy(0/2) =0,1,2,3
    for(let i=0;i<4;i++){
      if(i===quad) this.adapt.quadTimes[i] = Math.min(5200, this.adapt.quadTimes[i] + dt);
      else this.adapt.quadTimes[i] = Math.max(0, this.adapt.quadTimes[i] - dt*0.55);
    }
    // Dash detection (player.dashTimer vai de 160 ->0)
    if(player.dashTimer>0 && this.adapt.dashLast===0){
      this.adapt.dashTimes.push(this.battleTime);
      this.adapt.dashLast = this.battleTime;
    }
    if(player.dashTimer===0) this.adapt.dashLast=0;
    // Prune old dashes >6s
    this.adapt.dashTimes = this.adapt.dashTimes.filter(t=> this.battleTime - t < 6000);
    // Avg dist
    const dToBoss = dist(player.x, player.y, this.x, this.y);
    this.adapt.avgDist = lerp(this.adapt.avgDist, dToBoss, 0.04);
  }
  isPlayerCamping(){ return this.adapt.stationaryTime > BOSS5_ADAPT_CAMP_TIME; }
  getDominantQuadrant(){
    let best=0, bestT=-1;
    for(let i=0;i<4;i++) if(this.adapt.quadTimes[i] > bestT){ bestT=this.adapt.quadTimes[i]; best=i; }
    if(bestT > BOSS5_ADAPT_QUADRANT_TIME) return best;
    return -1;
  }
  getQuadrantCenter(q){
    const cx = (q===0||q===2) ? CANVAS_W*0.28 : CANVAS_W*0.72;
    const cy = (q===0||q===1) ? CANVAS_H*0.32 : CANVAS_H*0.72;
    return {x:cx, y:cy};
  }
  isRepetitiveDashing(){ return this.adapt.dashTimes.length >=3; }
  chooseRayMode(){
    // Pesos base por fase
    let wCenter=0, wTrack=0, wSweep=0;
    if(this.phase===1){ wCenter=78; wTrack=22; wSweep=0; }
    else if(this.phase===2){ wCenter=28; wTrack=52; wSweep=20; }
    else { wCenter=14; wTrack=44; wSweep=42; }
    // Adaptação: camping -> mais tracking
    if(this.isPlayerCamping()){ wTrack+=18; wCenter-=9; wSweep-=9; }
    // Quadrante dominante -> sweep eficaz para forçar movimento
    if(this.getDominantQuadrant()!==-1 && this.phase>=2){ wSweep+=14; wCenter-=7; wTrack-=7; }
    // Dashing repetitivo -> tracking preditivo
    if(this.isRepetitiveDashing()){ wTrack+=12; wCenter-=6; wSweep-=6; }
    // Normaliza
    wCenter=Math.max(5,wCenter); wTrack=Math.max(5,wTrack); wSweep=Math.max(0,wSweep);
    const tot=wCenter+wTrack+wSweep;
    const r=Math.random()*tot;
    if(r < wCenter) return 'center';
    if(r < wCenter+wTrack) return 'tracking';
    return 'sweep';
  }
  update(dt, player, walls, bulletOut, spawnList, allEnemies, particles, room){
    this.anim+=dt; this.battleTime+=dt;
    this.enrage = clamp(this.battleTime / 75000, 0, BOSS5_ENRAGE_SPEED_FACTOR);
    if(this.hitFlash>0) this.hitFlash-=dt;
    if(this.damageCooldown>0) this.damageCooldown-=dt;
    this.updateAdaptation(dt, player);
    this.updateHandPhaseParams();
    if(this.comboDelay>0) this.comboDelay-=dt;
    if(this.dead){
      this.victoryTimer+=dt;
      if(this.victoryTimer<2200 && Math.random()<0.45){
        const px=this.x+randRange(-16,16), py=this.y+randRange(-12,12)+Math.sin(this.anim*0.01)*2;
        particles.push(new Particle(px,py, randRange(-1.2,1.2), randRange(-1.8,0.4), 420, ['#ffd700','#ff8c42','#fff','#ff6a00'][randInt(0,3)], 2.5));
      }
      this.leftHand.update(dt, this.x, this.baseY, player, bulletOut, particles, room);
      this.rightHand.update(dt, this.x, this.baseY, player, bulletOut, particles, room);
      // ainda atualiza meteors/dash visuais durante morte para não travar
      return;
    }
    // --- DASH BOSS (investida da cabeça) tem prioridade de movimento ---
    if(this.isDashing){
      this.dashTime-=dt;
      const nx=this.x + this.dashDir.x * BOSS5_DASH_SPEED * (1+this.enrage*0.35);
      const ny=this.y + this.dashDir.y * BOSS5_DASH_SPEED * (1+this.enrage*0.35);
      let hitWall=false;
      if(this.collidesWalls(nx, this.y, walls)) hitWall=true; else this.x=nx;
      if(this.collidesWalls(this.x, ny, walls)) hitWall=true; else this.y=ny;
      this.x=clamp(this.x, WALL_THICK+this.w/2, CANVAS_W-WALL_THICK-this.w/2);
      this.y=clamp(this.y, WALL_THICK+this.h/2, CANVAS_H-WALL_THICK-this.h/2);
      this.dashTrail.push({x:this.x,y:this.y,life:240});
      if(this.dashTrail.length>10) this.dashTrail.shift();
      // dano durante dash
      if(rectCollide(player.x-player.w/2,player.y-player.h/2,player.w,player.h, this.x-this.w/2,this.y-this.h/2,this.w,this.h)){
        if(!player.isInvulnerable() && this.canDamage()){
          if(player.takeDamage(2)){
            for(let k=0;k<12;k++) particles.push(new Particle(player.x,player.y, randRange(-2.8,2.8), randRange(-2.8,1), 340, '#ff3b30',3));
          }
          this.resetDamageCooldown();
        }
        const ang=Math.atan2(player.y - this.y, player.x - this.x);
        player.x+=Math.cos(ang)*18; player.y+=Math.sin(ang)*18;
      }
      if(this.dashTime<=0 || hitWall){
        this.isDashing=false;
        this.dashCooldown= BOSS5_DASH_COOLDOWN * (1 - this.enrage*0.28) + randRange(-300,500);
        this.dashPrep=0;
        if(hitWall){
          for(let k=0;k<16;k++) particles.push(new Particle(this.x,this.y, randRange(-2.2,2.2), randRange(-1.6,0.6), 320, '#888',2));
          if(room) room.shake=90;
        } else {
          for(let k=0;k<10;k++) particles.push(new Particle(this.x,this.y, randRange(-1.6,1.6), randRange(-1.2,0.6), 280, '#ffd700',2));
        }
      }
      for(let i=this.dashTrail.length-1;i>=0;i--){ this.dashTrail[i].life-=dt; if(this.dashTrail[i].life<=0) this.dashTrail.splice(i,1); }
      // Durante dash, mantém mãos seguindo com lag
      this.leftHand.update(dt, this.x, this.baseY, player, bulletOut, particles, room);
      this.rightHand.update(dt, this.x, this.baseY, player, bulletOut, particles, room);
      this.y = clamp(this.y, this.baseY-6, this.baseY+18);
      return;
    }
    if(this.dashPrep>0){
      this.dashPrep-=dt;
      if(this.dashPrep<=0){
        this.isDashing=true;
        this.dashTime=BOSS5_DASH_DURATION;
        this.dashTrail=[];
      }
      // Mantém posição durante preparação (mostra aviso)
      this.leftHand.update(dt, this.x, this.baseY, player, bulletOut, particles, room);
      this.rightHand.update(dt, this.x, this.baseY, player, bulletOut, particles, room);
      return;
    }
    // Movimento lateral com velocidade faseada + enrage (gradual)
    const minX=WALL_THICK+44, maxX=CANVAS_W-WALL_THICK-44;
    this.x += this.dir * this.moveSpeed;
    if(this.x <= minX){ this.x=minX; this.dir=1; }
    if(this.x >= maxX){ this.x=maxX; this.dir=-1; }
    this.y = this.baseY + Math.sin(this.anim*0.003)*6;

    // Atualiza mãos (seguem cabeça) com room para shockwave
    this.leftHand.update(dt, this.x, this.baseY, player, bulletOut, particles, room);
    this.rightHand.update(dt, this.x, this.baseY, player, bulletOut, particles, room);

    // Fase 2: verifica quebra de escudo quando mãos destruídas
    if(this.headInvulnerable && this.phase===2){
      if(this.checkPhaseEnd()){
        for(let k=0;k<28;k++){ const ang=Math.random()*Math.PI*2; particles.push(new Particle(this.x,this.y, Math.cos(ang)*randRange(1.4,4.8), Math.sin(ang)*randRange(1.2,3.8), 520, '#ffd700', 3)); }
        for(let k=0;k<14;k++) particles.push(new Particle(this.x,this.y, randRange(-1.5,1.5), randRange(-1.5,0.6), 420, '#ffffff', 2));
        if(room) room.shake=140;
        // Pequeno stun do boss após quebrar escudo (janela extra)
        this.hitFlash=380;
      }
    }
    // Fase 3: controle de janela vulnerável
    if(this.phase===3){
      if(this.vulnWindow>0){
        this.vulnWindow-=dt;
        if(this.vulnWindow<=0){
          this.headInvulnerable=true;
          this.vulnCooldown= BOSS5_VULN_COOLDOWN_P3 * (1 - this.enrage*0.22) + randRange(-180,220);
        }
      } else {
        if(this.vulnCooldown>0) this.vulnCooldown-=dt;
        // Janela abre apenas via double slam ou timeout forçado
        if(this.vulnCooldown<=0 && !this.isRayWarning && !this.isRayActive && this.dashPrep<=0){
          // força double slam para abrir janela caso não tenha acontecido
          this.vulnCooldown = 999999; // trava até double slam abrir
        }
      }
    }

    // --- METEOROS (fase2+) ---
    if(this.phase>=2){
      if(this.meteorTimer>0) this.meteorTimer-=dt;
      // Atualiza meteors existentes (warning)
      for(let i=this.meteors.length-1;i>=0;i--){
        const m=this.meteors[i];
        m.warnTimer-=dt;
        if(m.warnTimer<=0 && !m.struck){
          m.struck=true;
          // Impacto: dano em área + partículas + cria explosão visual
          if(room) room.explosions.push({x:m.x,y:m.y,radius:12,life:380,max:380,isMeteor:true});
          for(let k=0;k<22;k++){ const ang=Math.random()*Math.PI*2; particles.push(new Particle(m.x,m.y, Math.cos(ang)*randRange(1.4,4.2), Math.sin(ang)*randRange(1.2,3.2), 420, ['#ff3b30','#ff6a00','#ffcc00'][randInt(0,2)], 2.6)); }
          for(let k=0;k<10;k++) particles.push(new Particle(m.x,m.y, randRange(-1.2,1.2), randRange(-1.4,0.4), 340, '#ffffff', 2));
          if(room) room.shake=Math.max(room.shake||0, 70);
          // Dano ao jogador se dentro do raio
          if(dist(player.x,player.y,m.x,m.y) < BOSS5_METEOR_RADIUS && !player.isInvulnerable()){
            if(player.takeDamage(1)){
              for(let k=0;k<8;k++) particles.push(new Particle(player.x,player.y, randRange(-1.8,1.8), randRange(-1.6,0.6), 260, '#ff3b30', 2));
              player.x += randRange(-10,10); player.y += randRange(-8,8);
            }
          }
          // Dano a inimigos invocados? não necessário
          // Após impacto, remove após breve
          m.life=180;
        }
        if(m.struck){
          m.life-=dt;
          if(m.life<=0) this.meteors.splice(i,1);
        }
      }
      if(this.meteorTimer<=0 && !this.isDashing && this.dashPrep<=0 && this.meteors.length===0){
        // Escolhe posições: adapta para punir camping/quadrante
        const count = this.phase===3 ? BOSS5_METEOR_COUNT : 3;
        let targets=[];
        // Se camping, 1 meteoro cai exatamente no jogador (exige esquiva)
        if(this.isPlayerCamping()){
          targets.push({x:player.x+randRange(-12,12), y:player.y+randRange(-12,12)});
        }
        // Se quadrante dominante, 1 meteoro no centro do quadrante
        const domQ=this.getDominantQuadrant();
        if(domQ!==-1 && targets.length < count){
          const qc=this.getQuadrantCenter(domQ);
          targets.push({x:qc.x+randRange(-18,18), y:qc.y+randRange(-18,18)});
        }
        // Completa com aleatórios na arena (evita spawn no boss)
        while(targets.length < count){
          let tx=randRange(CANVAS_W*0.22, CANVAS_W*0.78), ty=randRange(CANVAS_H*0.28, CANVAS_H*0.78);
          let bad=false;
          for(const w of walls) if(rectCollide(tx-16,ty-16,32,32,w.x,w.y,w.w,w.h)) {bad=true; break;}
          if(bad) continue;
          if(dist(tx,ty,this.x,this.y)< 80) continue;
          if(dist(tx,ty,player.x,player.y)< 46 && targets.length===0) continue; // evita todos em cima
          targets.push({x:tx,y:ty});
        }
        for(const t of targets){
          this.meteors.push({x:t.x,y:t.y, warnTimer:BOSS5_METEOR_WARNING, struck:false, life: BOSS5_METEOR_WARNING+180, radius:BOSS5_METEOR_RADIUS});
          // partículas aviso inicial
          for(let k=0;k<6;k++) particles.push(new Particle(t.x,t.y, randRange(-0.6,0.6), -0.9, 420, '#ff6a00', 1.6));
        }
        if(room) room.shake=Math.max(room.shake||0, 45);
        this.meteorTimer = (this.phase===3? BOSS5_METEOR_COOLDOWN_P3 : BOSS5_METEOR_COOLDOWN_P2) * (1 - this.enrage*0.22) + randRange(-500,700);
        // Combo: após meteoro, 35% chance de ray imediato (inesperado)
        if(Math.random()<0.35 && this.phase===3 && this.rayTimer>900){
          this.rayTimer = 620;
        }
      }
    }

    // --- SPIRAL / HAND VOLLEY (fase2+): rajadas rápidas entre slams ---
    if(this.phase>=2){
      if(this.spiralTimer>0) this.spiralTimer-=dt;
      if(this.spiralTimer<=0 && !this.isRayWarning && !this.isRayActive && !this.isDashing && this.dashPrep<=0){
        // Escolhe mão viva aleatória para disparar espiral ou aimed
        const aliveHands=[this.leftHand,this.rightHand].filter(h=>!h.dead && !h.isSlamming);
        if(aliveHands.length){
          const hand = aliveHands[randInt(0, aliveHands.length-1)];
          const pattern = (this.phase===3 && Math.random()<0.55) ? 'aimed' : (Math.random()<0.45?'spiral':'aimed');
          // Dispara diretamente sem slam: cria balas na posição da mão
          const cx=hand.x, cy=hand.y;
          const speedFac = 1 + this.enrage*0.22 + (this.phase===3?0.12:0);
          if(pattern==='spiral'){
            const baseAng=this.anim*0.002 + (hand.side==='left'?0:Math.PI);
            for(let i=0;i<BOSS5_SPIRAL_COUNT;i++){
              const ang= baseAng + (i/BOSS5_SPIRAL_COUNT)*Math.PI*2;
              bulletOut.push(new Bullet(cx,cy, Math.cos(ang), Math.sin(ang), 'enemy', {
                speed: BOSS5_PROJECTILE_SPEED*(0.98+this.enrage*0.35)*speedFac,
                damage:BOSS5_PROJECTILE_DAMAGE, range:520, size:BOSS5_PROJECTILE_SIZE,
                color:'#c084fc', glow:'rgba(192,132,252,0.32)'
              }));
            }
            for(let k=0;k<10;k++) particles.push(new Particle(cx,cy, randRange(-1.2,1.2), randRange(-1.2,0.6), 260, '#c084fc', 2));
          } else {
            const angToPlayer=Math.atan2(player.y-cy, player.x-cx);
            // Adaptação: se repetitive dashing, mira à frente do movimento do jogador
            let leadX=player.x, leadY=player.y;
            if(this.isRepetitiveDashing()){
              const velX = player.x - this.adapt.lastPos.x;
              const velY = player.y - this.adapt.lastPos.y;
              leadX += velX*10; leadY += velY*10;
            }
            const angLead=Math.atan2(leadY-cy, leadX-cx);
            for(let o=-1;o<=1;o++){
              const ang= angLead + o*0.26;
              bulletOut.push(new Bullet(cx,cy, Math.cos(ang), Math.sin(ang), 'enemy', {
                speed: BOSS5_PROJECTILE_SPEED*1.14*speedFac,
                damage:BOSS5_PROJECTILE_DAMAGE, range:540, size:BOSS5_PROJECTILE_SIZE,
                color:'#ffd700', glow:'rgba(255,215,0,0.32)'
              }));
            }
            for(let k=0;k<6;k++) particles.push(new Particle(cx,cy, randRange(-1,1), randRange(-1,0.6), 220, '#ffd700', 1.8));
          }
          // leves partículas e shake
          if(room) room.shake=Math.max(room.shake||0, 28);
        }
        this.spiralTimer = BOSS5_SPIRAL_COOLDOWN * (1 - this.enrage*0.28) + randRange(-340,420);
        // Em fase3, spiral mais frequente
        if(this.phase===3) this.spiralTimer *= 0.72;
      }
    }

    // --- DOUBLE SLAM (fase2+): ambas as mãos batem juntas, cria shockwaves duplas e abre janela P3 ---
    if(this.phase>=2){
      if(this.doubleSlamTimer>0) this.doubleSlamTimer-=dt;
      if(this.doubleSlamTimer<=0 && !this.isRayActive && !this.isRayWarning && !this.isDashing && this.dashPrep<=0){
        const leftAlive=!this.leftHand.dead, rightAlive=!this.rightHand.dead;
        if(leftAlive || rightAlive){
          // Determina alvos adaptativos
          let targetLeft=null, targetRight=null;
          // Se camping, mira no jogador com offset
          if(this.isPlayerCamping()){
            const base = {x: player.x, y: player.y};
            if(leftAlive) targetLeft={x: base.x - 22, y: base.y + randRange(-10,10)};
            if(rightAlive) targetRight={x: base.x + 22, y: base.y + randRange(-10,10)};
          } else if(this.getDominantQuadrant()!==-1){
            const qc=this.getQuadrantCenter(this.getDominantQuadrant());
            if(leftAlive) targetLeft={x: qc.x - 18, y: qc.y};
            if(rightAlive) targetRight={x: qc.x + 18, y: qc.y};
          } else {
            // Alvo padrão: levemente à frente do jogador
            const predX = player.x + (player.x - this.adapt.lastPos.x)*6;
            const predY = player.y + (player.y - this.adapt.lastPos.y)*6;
            if(leftAlive) targetLeft={x: clamp(predX-14, WALL_THICK+26, CANVAS_W-WALL_THICK-26), y: clamp(predY+randRange(-12,12), BOSS5_ARENA_Y+34, CANVAS_H-WALL_THICK-36)};
            if(rightAlive) targetRight={x: clamp(predX+14, WALL_THICK+26, CANVAS_W-WALL_THICK-26), y: clamp(predY+randRange(-12,12), BOSS5_ARENA_Y+34, CANVAS_H-WALL_THICK-36)};
          }
          const doubleAlive = leftAlive && rightAlive;
          // Inicia slams com pattern adaptativo
          const pattern = this.phase===3 && Math.random()<0.45 ? 'spiral' : 'radial';
          if(leftAlive) this.leftHand.startSlam({targetX: targetLeft?targetLeft.x:null, targetY: targetLeft?targetLeft.y:null, isDouble: doubleAlive, pattern: pattern, duration: BOSS5_HAND_SLAM_DUR*(doubleAlive?1.02:1)});
          if(rightAlive) this.rightHand.startSlam({targetX: targetRight?targetRight.x:null, targetY: targetRight?targetRight.y:null, isDouble: doubleAlive, pattern: pattern, duration: BOSS5_HAND_SLAM_DUR*(doubleAlive?1.02:1)});
          // Efeito shock + janela P3
          for(let k=0;k<24;k++){ const ang=Math.random()*Math.PI*2; particles.push(new Particle(this.x,this.y+12, Math.cos(ang)*randRange(1.2,3.8), Math.sin(ang)*randRange(1.2,3.8), 420, '#ff3b30', 2.2)); }
          if(room) room.shake=Math.max(room.shake||0, doubleAlive? 95: 62);
          // Fase3: abre janela vulnerável logo após impacto (com delay do slam duration) - timer manual confiável
          if(this.phase===3){
            this._pendingVulnOpen = BOSS5_HAND_SLAM_DUR*0.52;
          }
          this.doubleSlamTimer = BOSS5_DOUBLE_SLAM_COOLDOWN * (1 - this.enrage*0.24) + randRange(-400,600);
          if(this.phase===2) this.doubleSlamTimer *= 0.92;
          else this.doubleSlamTimer *= 0.78;
          // Combo: 45% chance de emendar ray logo após double slam (fase3)
          if(this.phase===3 && Math.random()<0.45){
            this.rayTimer = 520;
          }
          // Combo: 30% chance de meteoro rápido após double
          if(this.phase>=2 && Math.random()<0.30){
            this.meteorTimer = Math.min(this.meteorTimer, 1100);
          }
        } else {
          this.doubleSlamTimer = 1800;
        }
      }
      // Fallback abertura de janela se usando timer manual (sem setTimeout confiável em game loop)
      if(this._pendingVulnOpen!==undefined){
        this._pendingVulnOpen-=dt;
        if(this._pendingVulnOpen<=0){
          this._pendingVulnOpen=undefined;
          if(this.phase===3 && !this.dead){
            this.vulnWindow = BOSS5_VULN_WINDOW_P3;
            this.headInvulnerable=false;
            this.hitFlash=160;
            for(let k=0;k<16;k++){ const ang=Math.random()*Math.PI*2; particles.push(new Particle(this.x,this.y, Math.cos(ang)*randRange(1.2,3), Math.sin(ang)*randRange(1.2,3), 340, '#ffd700', 2)); }
          }
        }
      }
    } else {
      // Fase1: mãos auto-gerenciadas, mas boss pode ainda forçar single slam direcionado ocasionalmente para punir camping
      if(this.isPlayerCamping() && !this.isRayWarning && !this.isRayActive){
        // Se camping, força próximo slam a ser direcionado no jogador via hand target
        const hand = this.leftHand.slamTimer < this.rightHand.slamTimer ? this.leftHand : this.rightHand;
        if(!hand.isSlamming && hand.slamTimer < 320 && !hand.dead){
          // cancela timer e força targeted
          hand.slamTimer = 0;
          hand.startSlam({targetX: player.x+randRange(-10,10), targetY: player.y+randRange(-8,8), pattern:'radial'});
          this.adapt.stationaryTime = 0; // reseta para não spam
          if(room) room.shake=Math.max(room.shake||0, 32);
        }
      }
    }

    // --- RAY ATTACK com modos center/tracking/sweep ---
    if(this.isRayActive){
      this.rayDuration-=dt;
      // Sweep move progresso
      if(this.rayMode==='sweep'){
        this.sweepProgress += dt * (0.0016 * (1+this.enrage*0.45)) * this.sweepDir;
        if(this.sweepProgress>1){ this.sweepProgress=1; this.sweepDir=-1; }
        if(this.sweepProgress<0){ this.sweepProgress=0; this.sweepDir=1; }
      }
      if(this.rayDuration<=0){
        this.isRayActive=false; this.rayTarget=null; this.rayMode='center';
        this.rayTimer = (this.phase===1? BOSS5_RAY_COOLDOWN_P1 : this.phase===2? BOSS5_RAY_COOLDOWN_P2 : BOSS5_RAY_COOLDOWN_P3) * (1 - this.enrage*0.20) + randRange(-420,620);
        // Combo: 30% chance de double slam logo após ray em fase3
        if(this.phase===3 && Math.random()<0.33){
          this.doubleSlamTimer = Math.min(this.doubleSlamTimer, 720);
        }
      } else {
        // Calcula ray endpoints conforme modo
        let rayX=this.x, rayY=this.y+12, targetX, targetY;
        if(this.rayMode==='center'){
          targetX=CANVAS_W/2; targetY=CANVAS_H/2;
        } else if(this.rayMode==='tracking'){
          targetX=this.rayTarget.x; targetY=this.rayTarget.y;
        } else { // sweep
          // Varre horizontalmente em y ~ centro +/- 80
          const sweepMinX= WALL_THICK+50, sweepMaxX= CANVAS_W-WALL_THICK-50;
          targetX= lerp(sweepMinX, sweepMaxX, this.sweepProgress);
          targetY= CANVAS_H*0.52 + Math.sin(this.battleTime*0.0016)*22;
        }
        const len=Math.hypot(targetX-rayX, targetY-rayY)||1;
        const nx=(targetX-rayX)/len, ny=(targetY-rayY)/len;
        const toPlayerX=player.x-rayX, toPlayerY=player.y-rayY;
        const proj=toPlayerX*nx + toPlayerY*ny;
        let closestX, closestY;
        if(proj<0){ closestX=rayX; closestY=rayY; }
        else if(proj>len){ closestX=targetX; closestY=targetY; }
        else { closestX=rayX+nx*proj; closestY=rayY+ny*proj; }
        const w = (this.rayMode==='sweep'? BOSS5_RAY_WIDTH_SWEEP : BOSS5_RAY_WIDTH);
        const d=dist(player.x,player.y, closestX, closestY);
        if(d < w/2 + player.w*0.36){
          if(!player.isInvulnerable()){
            this.rayHitCooldown-=dt;
            if(this.rayHitCooldown<=0){
              if(player.takeDamage(BOSS5_RAY_DAMAGE)){
                for(let k=0;k<8;k++) particles.push(new Particle(player.x,player.y, randRange(-1.8,1.8), randRange(-1.6,0.6), 260, '#ffd700', 2));
              }
              this.rayHitCooldown= (this.rayMode==='sweep'? 420:520);
            }
          }
        } else {
          this.rayHitCooldown=Math.min(this.rayHitCooldown||0, 70);
        }
        if(Math.random()<0.58){
          const t=Math.random(); const rx=lerp(rayX, targetX, t)+randRange(-3,3), ry=lerp(rayY, targetY, t)+randRange(-3,3);
          particles.push(new Particle(rx,ry, randRange(-0.4,0.4), randRange(-0.4,0.4), 150, this.rayMode==='sweep'?'rgba(255,60,60,0.95)':'rgba(255,215,0,0.95)', 1.4));
          particles.push(new Particle(rx,ry, randRange(-0.3,0.3), randRange(-0.3,0.3), 110, 'rgba(255,255,255,0.95)', 1));
        }
        // Sweep dano extra: se player muito próximo da ponta varrendo, aplica knockback
        if(this.rayMode==='sweep' && dist(player.x,player.y, targetX,targetY) < 26 && !player.isInvulnerable()){
          if(this.rayHitCooldown<=0){
            player.takeDamage(1);
            this.rayHitCooldown=380;
          }
        }
      }
    } else if(this.isRayWarning){
      this.rayWarning-=dt;
      if(this.rayWarning<=0){
        this.isRayWarning=false; this.isRayActive=true;
        this.rayDuration= (this.rayMode==='sweep'? BOSS5_SWEEP_DURATION : BOSS5_RAY_DURATION);
        this.rayHitCooldown=0;
        if(particles){
          for(let k=0;k<22;k++){ const ang=Math.random()*Math.PI*2; particles.push(new Particle(this.x, this.y+8, Math.cos(ang)*randRange(1.4,3.4), Math.sin(ang)*randRange(1.2,3.2), 320, this.rayMode==='sweep'?'#ff3b30':'#ffd700', 2)); }
        }
        if(room) room.shake= (this.rayMode==='sweep'?95:78);
      }
    } else {
      if(this.rayTimer>0) this.rayTimer-=dt;
      if(this.rayTimer<=0 && !this.isRayWarning && !this.isRayActive && !this.isDashing && this.dashPrep<=0){
        this.rayMode=this.chooseRayMode();
        this.isRayWarning=true;
        if(this.phase===1) this.rayWarning=BOSS5_RAY_WARNING_P1;
        else if(this.phase===2) this.rayWarning=BOSS5_RAY_WARNING_P2;
        else this.rayWarning=BOSS5_RAY_WARNING_P3;
        // Ajusta warning com enrage levemente (mas nunca abaixo de 620ms para justiça)
        this.rayWarning = Math.max(620, this.rayWarning * (1 - this.enrage*0.18));
        if(this.rayMode==='center'){
          this.rayTarget={x:CANVAS_W/2, y:CANVAS_H/2};
        } else if(this.rayMode==='tracking'){
          // Trava onde jogador ESTÁ agora, mas com leve previsão (lead) se está em movimento
          const leadX = player.x + (player.x - this.adapt.lastPos.x)*8;
          const leadY = player.y + (player.y - this.adapt.lastPos.y)*8;
          this.rayTarget={x: clamp(leadX, WALL_THICK+30, CANVAS_W-WALL_THICK-30), y: clamp(leadY, WALL_THICK+30, CANVAS_H-WALL_THICK-30)};
          // Se repetitive dashing, mira onde dash vai terminar (predição ousada)
          if(this.isRepetitiveDashing()){
            const dashVec = normalize(player.x - this.adapt.lastPos.x, player.y - this.adapt.lastPos.y);
            this.rayTarget.x = clamp(this.rayTarget.x + dashVec.x*38, WALL_THICK+28, CANVAS_W-WALL_THICK-28);
            this.rayTarget.y = clamp(this.rayTarget.y + dashVec.y*38, WALL_THICK+28, CANVAS_H-WALL_THICK-28);
          }
        } else { // sweep
          this.sweepProgress = (player.x < CANVAS_W/2? 0:1);
          this.sweepDir = (this.sweepProgress===0?1:-1);
          this.rayTarget={x: lerp(WALL_THICK+50, CANVAS_W-WALL_THICK-50, this.sweepProgress), y: CANVAS_H*0.52};
          this.rayWarning += 110; // sweep precisa 110ms extra de aviso
        }
        if(particles) for(let k=0;k<7;k++) particles.push(new Particle(this.x,this.y, randRange(-0.8,0.8), randRange(-0.8,0.6), 260, this.rayMode==='sweep'?'#ff6b6b':'#ffd700', 1.6));
      }
    }

    // --- SUMMON (composição por fase) ---
    if(this.summonTimer>0) this.summonTimer-=dt;
    if(this.summonTimer<=0 && !this.isRayWarning && !this.isRayActive && !this.isDashing && this.dashPrep<=0 && this.meteors.length===0){
      this.summoned=this.summoned.filter(e=> !e.dead && allEnemies.includes(e));
      const totalInRoom=allEnemies.length;
      const maxTotal = BOSS5_SUMMON_TOTAL_MAX + (this.phase===3?1:0);
      const maxCycle = BOSS5_SUMMON_MAX + (this.phase===3?1:0);
      if(this.summoned.length < maxCycle && totalInRoom < maxTotal + 1){
        let sx,sy,tries=0;
        do{
          sx=randRange(CANVAS_W*0.24, CANVAS_W*0.76);
          sy=randRange(CANVAS_H*0.42, CANVAS_H*0.78);
          tries++;
          let onWall=false;
          for(const w of walls) if(rectCollide(sx-14,sy-14,28,28,w.x,w.y,w.w,w.h)) {onWall=true; break;}
          if(!onWall && dist(sx,sy,player.x,player.y)>68 && dist(sx,sy,this.x,this.y)>88) break;
        }while(tries<16);
        const roll=Math.random();
        let e;
        if(this.phase===3){
          if(roll<0.32) e=new Chaser(sx,sy);
          else if(roll<0.52) e=new Fugitive(sx,sy);
          else if(roll<0.74) e=new Kamikaze(sx,sy);
          else if(roll<0.88) e=new DashEnemy(sx,sy);
          else e=new Summoner(sx,sy);
        } else if(this.phase===2){
          if(roll<0.38) e=new Chaser(sx,sy);
          else if(roll<0.62) e=new Fugitive(sx,sy);
          else if(roll<0.84) e=new Kamikaze(sx,sy);
          else e=new DashEnemy(sx,sy);
        } else {
          if(roll<0.48) e=new Chaser(sx,sy);
          else if(roll<0.74) e=new Fugitive(sx,sy);
          else e=new Kamikaze(sx,sy);
        }
        e.hp = Math.max(1, Math.floor(e.maxHp*(this.phase===3?0.92:0.82))); e.maxHp=e.hp;
        if(this.phase===3){ e.speed *= 1.08; }
        e.isSummoned=true;
        applyEnemyVariation(e, Math.random, 3);
        spawnList.push(e); this.summoned.push(e);
        if(particles) for(let k=0;k<10;k++) particles.push(new Particle(sx,sy, randRange(-1.4,1.4), randRange(-1.4,0.6), 340, this.phase===3?'#ff3b30':'#ffd700', 2));
        const baseCd = this.phase===1? BOSS5_SUMMON_COOLDOWN_P1 : this.phase===2? BOSS5_SUMMON_COOLDOWN_P2 : BOSS5_SUMMON_COOLDOWN_P3;
        this.summonTimer= baseCd * (1 - this.enrage*0.22) + randRange(-420,620);
      } else {
        this.summonTimer= 860;
      }
    }

    // --- DASH BOSS (fase3) ---
    if(this.phase===3){
      if(this.dashCooldown>0) this.dashCooldown-=dt;
      if(this.dashCooldown<=0 && !this.isRayWarning && !this.isRayActive && this.meteors.length===0 && Math.random()<0.018){
        // Prepara dash na direção do jogador (com aviso 620ms)
        const dir=normalize(player.x - this.x, player.y - this.y);
        this.dashDir=dir;
        this.dashPrep=BOSS5_DASH_PREP;
        this.dashCooldown= 999999; // trava até dash terminar
        // partículas aviso
        for(let k=0;k<10;k++) particles.push(new Particle(this.x,this.y, dir.x*randRange(0.5,1.4)+randRange(-0.6,0.6), dir.y*randRange(0.5,1.4)+randRange(-0.6,0.6), 300, '#ff3b30', 2));
        if(room) room.shake=Math.max(room.shake||0, 38);
      }
    }

    // Dano por contato cabeça
    if(rectCollide(player.x-player.w/2,player.y-player.h/2,player.w,player.h, this.x-this.w/2,this.y-this.h/2,this.w,this.h)){
      if(!player.isInvulnerable() && this.canDamage()){
        if(player.takeDamage(this.phase===3?2:1)){
          for(let k=0;k<10;k++) particles.push(new Particle(player.x,player.y, randRange(-2.5,2.5), randRange(-2.5,1), 320, '#ffd700',3));
        }
        this.resetDamageCooldown();
      }
    }
    // Mãos contato e shockwave dano via explosões
    for(const hand of [this.leftHand, this.rightHand]){
      if(hand.dead) continue;
      if(rectCollide(player.x-player.w/2,player.y-player.h/2,player.w,player.h, hand.x-hand.w/2,hand.y-hand.h/2,hand.w,hand.h)){
        const isGround=hand.groundedVuln>0;
        if(hand.canDamage() && !player.isInvulnerable()){
          if(player.takeDamage(isGround? BOSS5_HAND_SLAM_DAMAGE : 1)){
            for(let k=0;k<9;k++) particles.push(new Particle(player.x,player.y, randRange(-2.2,2.2), randRange(-2.5,0), 340, '#ff8c42',2));
          }
          hand.resetDamageCooldown();
        }
        const ang=Math.atan2(player.y - hand.y, player.x - hand.x);
        player.x+=Math.cos(ang)* (isGround?15:7);
        player.y+=Math.sin(ang)* (isGround?15:7);
        player.x=clamp(player.x, WALL_THICK+player.w/2, CANVAS_W-WALL_THICK-player.w/2);
        player.y=clamp(player.y, WALL_THICK+player.h/2, CANVAS_H-WALL_THICK-player.h/2);
      }
    }
    // Shockwave dano (anel expansivo)
    if(room && room.explosions){
      for(const ex of room.explosions){
        if(!ex.isShockwave) continue;
        const prog = 1 - (ex.life/ex.max);
        const curR = 10 + prog*(BOSS5_SHOCKWAVE_MAX-10);
        const ringW = BOSS5_SHOCKWAVE_RING_WIDTH + (ex.isDouble?4:0);
        const d=dist(player.x,player.y, ex.x, ex.y);
        const outer=curR, inner=Math.max(0, curR - ringW);
        // Detecta entrada no anel (d dentro da coroa)
        if(d >= inner && d <= outer){
          // Evita dano contínuo: usa cooldown do player + cooldown do anel
          if(!ex._hitCd) ex._hitCd=0;
          ex._hitCd-=dt;
          if(ex._hitCd<=0 && !player.isInvulnerable()){
            if(player.takeDamage(BOSS5_SHOCKWAVE_DMG)){
              for(let k=0;k<7;k++) particles.push(new Particle(player.x,player.y, randRange(-1.6,1.6), randRange(-1.4,0.6), 260, '#ff6a00', 2));
              // knockback radial
              const ang=Math.atan2(player.y-ex.y, player.x-ex.x) || Math.random()*Math.PI*2;
              player.x+=Math.cos(ang)*10; player.y+=Math.sin(ang)*10;
            }
            ex._hitCd= 420; // só pode acertar 1x por 420ms por anel
            if(room) room.shake=Math.max(room.shake||0, 48);
          }
        } else {
          // fora, reseta para poder acertar ao entrar
          if(ex._hitCd!==undefined && ex._hitCd<0) ex._hitCd=Math.min(ex._hitCd, 60);
        }
      }
    }
  }
  draw(ctx){
    const x=this.x - this.w/2, y=this.y - this.h/2, bob=Math.sin(this.anim*0.007)*1.6 + Math.cos(this.anim*0.004)*0.7;
    const isFlash=this.hitFlash>0 && Math.floor(this.hitFlash/40)%2===0;
    const isInvuln=this.headInvulnerable;
    // Determina fase para aura (com transição visual)
    const phase = this.phase || (this.phase3Triggered?3:this.phase2Triggered?2:1);
    ctx.fillStyle='rgba(0,0,0,0.34)'; ctx.fillRect(x+3, y+this.h-2, this.w, 3);
    // Aura por fase + enrage pulsante
    if(isInvuln){
      const pulse=0.5+Math.sin(this.anim*0.012)*0.28 + this.enrage*0.18;
      if(phase===3 && this.vulnWindow>0){
        // Janela dourada aberta - VULNERÁVEL
        ctx.fillStyle=`rgba(255,215,0,${0.22+pulse*0.12})`;
        ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*1.08+pulse*5,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle=`rgba(255,215,0,${0.65+pulse*0.15})`; ctx.lineWidth=2.2;
        ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*1.02,0,Math.PI*2); ctx.stroke();
        ctx.fillStyle='rgba(255,255,255,0.92)'; ctx.font='6px monospace'; ctx.textAlign='center';
        ctx.fillText('VULNERÁVEL!', this.x, y-16+bob); ctx.textAlign='left';
        // barra janela
        const p= clamp(this.vulnWindow / BOSS5_VULN_WINDOW_P3,0,1);
        ctx.fillStyle='rgba(0,0,0,0.70)'; ctx.fillRect(x-6, y-12+bob, this.w+12, 3);
        ctx.fillStyle='#ffd700'; ctx.fillRect(x-6, y-12+bob, (this.w+12)*p, 3);
      } else if(phase===2){
        ctx.fillStyle=`rgba(180,180,190,${0.16+pulse*0.08})`;
        ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.95+pulse*3,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle=`rgba(200,200,210,0.32)`; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.90,0,Math.PI*2); ctx.stroke();
        ctx.strokeStyle='rgba(180,180,190,0.45)'; ctx.lineWidth=1.2; ctx.setLineDash([5,4]);
        ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*1.12,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle='rgba(255,255,255,0.78)'; ctx.font='6px monospace'; ctx.textAlign='center';
        ctx.fillText('BLOQUEADO', this.x, y-16+bob); ctx.textAlign='left';
        ctx.fillStyle='rgba(255,215,0,0.85)'; ctx.font='5px monospace'; ctx.textAlign='center';
        ctx.fillText('DESTRUA AS MÃOS', this.x, y-26+bob); ctx.textAlign='left';
      } else { // phase3 shielded
        ctx.fillStyle=`rgba(255,80,60,${0.14+pulse*0.08})`;
        ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*1.02+pulse*4,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle=`rgba(255,60,60,0.38)`; ctx.lineWidth=1.6; ctx.setLineDash([6,4]);
        ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*1.08,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle='rgba(255,255,255,0.78)'; ctx.font='6px monospace'; ctx.textAlign='center';
        ctx.fillText('ESCUDO', this.x, y-16+bob); ctx.textAlign='left';
        ctx.fillStyle='rgba(255,215,0,0.72)'; ctx.font='5px monospace'; ctx.textAlign='center';
        const cdSec=Math.ceil(Math.max(0,this.vulnCooldown)/1000);
        ctx.fillText(`Janela em ${cdSec}s`, this.x, y-26+bob); ctx.textAlign='left';
      }
    } else if(phase===2 || phase===3){
      const pulse=0.5+Math.sin(this.anim*0.014)*0.24 + this.enrage*0.12;
      if(phase===3 && this.vulnWindow>0){
        // Janela aberta: ouro pulsante + texto
        ctx.fillStyle=`rgba(255,215,0,${0.22+pulse*0.12})`;
        ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*1.08+pulse*5,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle=`rgba(255,215,0,${0.65+pulse*0.15})`; ctx.lineWidth=2.2;
        ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*1.02,0,Math.PI*2); ctx.stroke();
        ctx.fillStyle='rgba(255,255,255,0.92)'; ctx.font='6px monospace'; ctx.textAlign='center';
        ctx.fillText('VULNERÁVEL!', this.x, y-16+bob); ctx.textAlign='left';
        const p= clamp(this.vulnWindow / BOSS5_VULN_WINDOW_P3,0,1);
        ctx.fillStyle='rgba(0,0,0,0.70)'; ctx.fillRect(x-6, y-12+bob, this.w+12, 3);
        ctx.fillStyle='#ffd700'; ctx.fillRect(x-6, y-12+bob, (this.w+12)*p, 3);
      } else {
        ctx.fillStyle=`rgba(255,215,0,${0.12+pulse*0.07})`;
        ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.98+pulse*3,0,Math.PI*2); ctx.fill();
      }
      // Indicador de enrage sutil (brilho avermelhado crescente)
      if(this.enrage>0.12){
        ctx.fillStyle=`rgba(255,60,60,${this.enrage*0.10})`;
        ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*1.12,0,Math.PI*2); ctx.fill();
      }
    }
    // Dash trail
    for(const t of this.dashTrail){
      const a=clamp(t.life/240,0,1);
      ctx.fillStyle=`rgba(255,59,48,${a*0.22})`;
      ctx.beginPath(); ctx.arc(t.x, t.y+bob*0.5, 7*a,0,Math.PI*2); ctx.fill();
    }
    // Dash prep warning
    if(this.dashPrep>0){
      const p= 1 - (this.dashPrep / BOSS5_DASH_PREP);
      ctx.strokeStyle=`rgba(255,60,60,${0.45+p*0.35})`;
      ctx.lineWidth=2.5; ctx.setLineDash([6,4]);
      ctx.beginPath(); ctx.moveTo(this.x, this.y+bob); ctx.lineTo(this.x+this.dashDir.x*96, this.y+bob+this.dashDir.y*96); ctx.stroke(); ctx.setLineDash([]);
      const ax=this.x+this.dashDir.x*(96+Math.sin(this.anim*0.02)*4), ay=this.y+bob+this.dashDir.y*(96+Math.sin(this.anim*0.02)*4);
      ctx.fillStyle='rgba(255,80,80,0.95)';
      ctx.beginPath(); const ang=Math.atan2(this.dashDir.y,this.dashDir.x);
      ctx.moveTo(ax,ay); ctx.lineTo(ax-Math.cos(ang-Math.PI/6)*14, ay-Math.sin(ang-Math.PI/6)*14); ctx.lineTo(ax-Math.cos(ang+Math.PI/6)*14, ay-Math.sin(ang+Math.PI/6)*14); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#fff'; ctx.font='7px monospace'; ctx.textAlign='center'; ctx.fillText('!!!', this.x, y-12+bob); ctx.textAlign='left';
      ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(x, y-10+bob, this.w, 2);
      ctx.fillStyle='#ff3b30'; ctx.fillRect(x, y-10+bob, this.w*p, 2);
    }
    // Meteor warnings (círculos vermelhos no chão)
    for(const m of this.meteors){
      if(m.struck) continue;
      const p= 1 - (m.warnTimer / BOSS5_METEOR_WARNING);
      // sombra de alvo pulsante
      ctx.fillStyle=`rgba(255,60,60,${0.10+p*0.18})`;
      ctx.beginPath(); ctx.arc(m.x, m.y, BOSS5_METEOR_RADIUS + p*6,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle=`rgba(255,60,60,${0.55+p*0.35})`; ctx.lineWidth=2; ctx.setLineDash([6,4]);
      ctx.beginPath(); ctx.arc(m.x, m.y, BOSS5_METEOR_RADIUS,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
      // cruz no centro
      ctx.strokeStyle=`rgba(255,255,255,${0.65+p*0.3})`; ctx.lineWidth=1.2;
      ctx.beginPath(); ctx.moveTo(m.x-8, m.y); ctx.lineTo(m.x+8, m.y); ctx.moveTo(m.x, m.y-8); ctx.lineTo(m.x, m.y+8); ctx.stroke();
      ctx.fillStyle='rgba(255,60,60,0.95)'; ctx.font='6px monospace'; ctx.textAlign='center';
      ctx.fillText('!', m.x, m.y- BOSS5_METEOR_RADIUS-8); ctx.textAlign='left';
      // Barra de warning
      ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(m.x-16, m.y- BOSS5_METEOR_RADIUS-16, 32, 3);
      ctx.fillStyle='#ff3b30'; ctx.fillRect(m.x-16, m.y- BOSS5_METEOR_RADIUS-16, 32*p, 3);
    }
    // Ray warning / active com modos distintos
    if(this.isRayWarning){
      const baseWarn = this.phase===1? BOSS5_RAY_WARNING_P1 : this.phase===2? BOSS5_RAY_WARNING_P2 : BOSS5_RAY_WARNING_P3;
      const p=1 - (this.rayWarning / baseWarn);
      let targetX, targetY;
      if(this.rayMode==='center'){ targetX=CANVAS_W/2; targetY=CANVAS_H/2; }
      else if(this.rayMode==='tracking'){ targetX=this.rayTarget.x; targetY=this.rayTarget.y; }
      else { targetX=this.rayTarget.x; targetY=this.rayTarget.y; }
      const col = this.rayMode==='sweep'?'255,60,60' : this.rayMode==='tracking'?'192,132,252' : '255,215,0';
      ctx.strokeStyle=`rgba(${col},${0.35+p*0.45})`;
      ctx.lineWidth= (this.rayMode==='sweep'?2.2:1.5); ctx.setLineDash([6,4]);
      ctx.beginPath(); ctx.moveTo(this.x, this.y+12+bob); ctx.lineTo(targetX, targetY); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle=`rgba(${col},${0.45+p*0.35})`; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(targetX, targetY, 14 + p*8,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle=`rgba(${col},${0.22+p*0.22})`;
      ctx.beginPath(); ctx.arc(targetX, targetY, 6,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=`rgba(${col},0.95)`; ctx.font='7px monospace'; ctx.textAlign='center';
      ctx.fillText(this.rayMode==='sweep'?'◄►': this.rayMode==='tracking'?'◎':'⚡', targetX, targetY-18); ctx.textAlign='left';
      // Tipo de ray no boss
      ctx.fillStyle=`rgba(${col},0.90)`; ctx.font='5px monospace'; ctx.textAlign='center';
      ctx.fillText(this.rayMode==='sweep'?'VARREDURA': this.rayMode==='tracking'?'RASTREIO':'RAIO', this.x, y-18+bob); ctx.textAlign='left';
      ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(x, y-12+bob, this.w, 3);
      ctx.fillStyle= this.rayMode==='sweep'?'#ff6b6b': this.rayMode==='tracking'?'#c084fc':'#ffd700'; ctx.fillRect(x, y-12+bob, this.w*p, 3);
    }
    if(this.isRayActive){
      let rayX=this.x, rayY=this.y+14+bob, targetX, targetY;
      if(this.rayMode==='center'){ targetX=CANVAS_W/2; targetY=CANVAS_H/2; }
      else if(this.rayMode==='tracking'){ targetX=this.rayTarget.x; targetY=this.rayTarget.y; }
      else {
        const sweepMinX=WALL_THICK+50, sweepMaxX=CANVAS_W-WALL_THICK-50;
        targetX= lerp(sweepMinX, sweepMaxX, this.sweepProgress);
        targetY= CANVAS_H*0.52 + Math.sin(this.battleTime*0.0016)*22;
      }
      const isSweep=this.rayMode==='sweep';
      ctx.strokeStyle= isSweep?'rgba(255,60,60,0.96)':'rgba(255,235,59,0.95)';
      ctx.lineWidth= isSweep? BOSS5_RAY_WIDTH_SWEEP : BOSS5_RAY_WIDTH;
      ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(rayX, rayY); ctx.lineTo(targetX, targetY); ctx.stroke();
      ctx.strokeStyle='rgba(255,255,255,0.98)';
      ctx.lineWidth=4;
      ctx.beginPath(); ctx.moveTo(rayX, rayY); ctx.lineTo(targetX, targetY); ctx.stroke();
      ctx.lineCap='butt';
      ctx.fillStyle= isSweep?'rgba(255,60,60,0.18)':'rgba(255,215,0,0.18)';
      ctx.beginPath(); ctx.arc(targetX, targetY, 22,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.92)';
      ctx.beginPath(); ctx.arc(rayX, rayY, 6,0,Math.PI*2); ctx.fill();
      if(Math.random()<0.6){
        ctx.fillStyle='#fff';
        ctx.fillRect(targetX + randRange(-6,6), targetY+randRange(-6,6), 2,2);
      }
      // Sweep ponta extra brilho
      if(isSweep){
        ctx.fillStyle='rgba(255,255,255,0.88)';
        ctx.beginPath(); ctx.arc(targetX, targetY, 5,0,Math.PI*2); ctx.fill();
      }
    }

    // Cabeça boss - imponente, com coroa/olhos
    // Sombra escada atrás
    ctx.fillStyle='rgba(40,30,10,0.22)';
    ctx.fillRect(x-6, y-10+bob, this.w+12, this.h+14);
    ctx.fillStyle=isFlash?'#fff': isInvuln?'#9a9aa0':'#5a2e12';
    ctx.fillRect(x+2, y+4+bob, this.w-4, this.h-8);
    ctx.fillStyle=isFlash?'#ffd700': isInvuln?'#c0c0c8':'#8b4513';
    ctx.fillRect(x, y+6+bob, 4, this.h-12);
    ctx.fillRect(x+this.w-4, y+6+bob, 4, this.h-12);
    // Topo cabeça / coroa escada
    ctx.fillStyle=isFlash?'#fff': isInvuln?'#e0e0e8':'#ffd700';
    ctx.fillRect(x+6, y-2+bob, this.w-12, 10);
    ctx.fillStyle=isFlash?'#fff8a0':'#b8860b';
    ctx.fillRect(x+8, y+2+bob, this.w-16, 3);
    // Degraus na coroa
    ctx.fillStyle=isFlash?'#ffffff':'#3a1a0a';
    for(let i=0;i<3;i++) ctx.fillRect(x+10+i*3, y+4+bob+i*1.5, this.w-20 - i*6, 1.2);
    // Olhos grandes
    const eyeY=y+9+bob;
    ctx.fillStyle=isFlash?'#fff':'#1a0a00';
    ctx.fillRect(x+8, eyeY, 8,6);
    ctx.fillRect(x+this.w-16, eyeY, 8,6);
    ctx.fillStyle=isInvuln?'#a0a0b0':'#ff3b30';
    ctx.fillRect(x+9, eyeY+1, 6,3);
    ctx.fillRect(x+this.w-15, eyeY+1, 6,3);
    ctx.fillStyle='#fff';
    ctx.fillRect(x+10, eyeY+2, 2,1);
    ctx.fillRect(x+this.w-14, eyeY+2, 2,1);
    // Pupila se perseguindo
    const pupilPhase=Math.sin(this.anim*0.004);
    ctx.fillStyle='#000';
    ctx.fillRect(x+11 + pupilPhase*1, eyeY+3, 2,1);
    ctx.fillRect(x+this.w-13 + pupilPhase*1, eyeY+3, 2,1);
    // Boca escada (degraus)
    ctx.fillStyle='#2a0a00';
    ctx.fillRect(x+12, y+18+bob, this.w-24, 6);
    for(let i=0;i<3;i++){
      ctx.fillStyle=i%2===0?'#ffd700':'#ff8c42';
      ctx.fillRect(x+14 + i*4, y+19+bob, this.w-28 - i*2, 1.2);
    }
    // Runa central cabeça
    ctx.fillStyle= isInvuln?'rgba(180,180,190,0.85)':'rgba(255,215,0,0.95)';
    ctx.beginPath(); ctx.arc(this.x, y+14+bob, 5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#000'; ctx.font='6px monospace'; ctx.textAlign='center';
    ctx.fillText(isInvuln?'✕':'✦', this.x, y+16+bob); ctx.textAlign='left';

    // Barra vida cabeça grande (topo) com marcadores de fase 64% e 34%
    const hpPct=clamp(this.hp/this.maxHp,0,1);
    ctx.fillStyle='rgba(0,0,0,0.78)'; ctx.fillRect(x-8, y-18+bob, this.w+16, 7);
    const col = phase===1 ? '#ffd700' : phase===2 ? '#ff8c42' : '#ff3b30';
    ctx.fillStyle=hpPct>0.5? col : hpPct>0.2? '#ff8c42':'#ef4444'; ctx.fillRect(x-8, y-18+bob, (this.w+16)*hpPct, 7);
    ctx.strokeStyle='rgba(255,255,255,0.22)'; ctx.lineWidth=1; ctx.strokeRect(x-8, y-18+bob, this.w+16, 7);
    ctx.fillStyle='#fff'; ctx.font='5px "Press Start 2P"'; ctx.textAlign='center';
    ctx.fillText(`BOSS ESCADA F${phase}`, this.x, y-24+bob); ctx.textAlign='left';
    // Marcadores 64% e 34%
    const m64X = x-8 + (this.w+16)*BOSS5_PHASE2_AT;
    const m34X = x-8 + (this.w+16)*BOSS5_PHASE3_AT;
    ctx.fillStyle='rgba(0,0,0,0.85)'; ctx.fillRect(m64X, y-18+bob, 1, 7); ctx.fillRect(m34X, y-18+bob, 1, 7);
    ctx.fillStyle='rgba(255,215,0,0.85)'; ctx.fillRect(m64X, y-20+bob, 1, 3);
    ctx.fillStyle='rgba(255,60,60,0.85)'; ctx.fillRect(m34X, y-20+bob, 1, 3);
    // Texto fase pequena
    ctx.fillStyle='rgba(255,255,255,0.62)'; ctx.font='4px monospace'; ctx.textAlign='center';
    ctx.fillText('F2', m64X, y-26+bob); ctx.fillText('F3', m34X, y-26+bob); ctx.textAlign='left';

    // Conectores braços (linhas da cabeça até mãos)
    ctx.strokeStyle=isFlash?'rgba(255,255,255,0.55)': isInvuln?'rgba(140,140,150,0.35)':'rgba(90,46,10,0.35)';
    ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(this.x-8, y+10+bob); ctx.lineTo(this.leftHand.x, this.leftHand.y -6 + bob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(this.x+8, y+10+bob); ctx.lineTo(this.rightHand.x, this.rightHand.y -6 + bob); ctx.stroke();

    // Mãos desenham depois? Mãos têm seu próprio draw, mas já atualizamos posição; desenhar aqui após cabeça para ficar na frente?
    // O draw das mãos será chamado externamente (Game/Room) depois da cabeça? Para manter ordem, faremos mãos serem desenhadas aqui dentro
    // No entanto StairBoss.draw já é único, então desenha mãos dentro
    this.leftHand.draw(ctx);
    this.rightHand.draw(ctx);

    // Morte animação
    if(this.dead){
      const t=clamp(this.victoryTimer/900,0,1);
      ctx.fillStyle=`rgba(255,255,255,${t*0.42})`;
      ctx.fillRect(x-6, y-6+bob, this.w+12, this.h+12);
      if(t>0.6){
        ctx.fillStyle=`rgba(255,215,0,${(t-0.6)*1.2})`;
        ctx.beginPath(); ctx.arc(this.x, this.y+bob, 18 + t*12,0,Math.PI*2); ctx.fill();
      }
    }
  }
  // Retorna retângulos de colisão da cabeça (para tiro) e mãos (se vulneráveis)
  getHeadRect(){ return {x:this.x-this.w/2,y:this.y-this.h/2,w:this.w,h:this.h}; }
  getHands(){ return [this.leftHand, this.rightHand]; }
  isHeadInvulnerable(){ return this.headInvulnerable; }
}

// ===================== HACKER - BOSS FINAL SECRETO (DARK VÍRUS) =====================
// Boss secreto com 4 fases, tamanho do jogador, visual Neutro corrompido, glitches e Dark Vírus
class HackerBoss {
  constructor(x,y){
    this.x=x; this.y=y;
    this.w=HACKER_SIZE; this.h=HACKER_SIZE;
    this.hp=HACKER_HP; this.maxHp=HACKER_HP;
    this.dead=false; this.hitFlash=0; this.anim=0;
    this.type='hacker';
    this.damageCooldown=0;
    this.speed=HACKER_SPEED;
    this.dir=1;
    this.phase=1;
    this.dialogShown=false;
    this.dialogTimer=0;
    this.battleStarted=false;
    this.victoryTimer=0;
    this.glitchTimer=0;
    this.shootTimer=HACKER_SHOOT_COOLDOWN_P1;
    this.dashPrep=0; this.isDashing=false; this.dashDir={x:0,y:0}; this.dashTime=0; this.dashCooldown=HACKER_DASH_COOLDOWN;
    this.bazookaTimer=HACKER_BAZOOKA_COOLDOWN;
    this.summonTimer=HACKER_SUMMON_COOLDOWN_P2;
    this.healTimer=HACKER_HEAL_SPAWN_COOLDOWN;
    this.carCooldown=HACKER_CAR_COOLDOWN;
    this.carState='idle'; // idle, prep, offscreen, charging, recover
    this.carTimer=0;
    this.carDir=1;
    this.carY=0;
    this.carX=0;
    this.punchTimer=0;
    this.enrage=0;
    this.battleTime=0;
    this.codeChars=['0','1','█','▓','▒','<','>','/','\\','*'];
    this.lastCodeParticle=0;
  }
  getPhase(){
    const pct=this.hp/this.maxHp;
    if(pct>0.75) return 1;
    if(pct>0.50) return 2;
    if(pct>0.10) return 3;
    return 4;
  }
  getPhaseName(){
    const p=this.getPhase();
    return p===1?'GLITCH': p===2?'BAZUCA': p===3?'DARK CAR': 'PUNHO';
  }
  takeDamage(dmg){
    if(this.dead) return false;
    // hacker sempre vulnerável, mas fase 4 só corpo a corpo? Ainda toma dano à distância mas com redução 40% para forçar melee? Mantemos vulnerável total para não frustrar
    this.hp-=dmg; this.hitFlash=160;
    if(this.hp<=0){ this.hp=0; this.dead=true; this.victoryTimer=0; return true; }
    return false;
  }
  canDamage(){ return this.damageCooldown<=0; }
  resetDamageCooldown(){ this.damageCooldown=620; }
  collidesWalls(nx,ny,walls){
    const hw=this.w/2, hh=this.h/2, rx=nx-hw, ry=ny-hh;
    for(const w of walls) if(rectCollide(rx,ry,this.w,this.h,w.x,w.y,w.w,w.h)) return true;
    return false;
  }
  update(dt, player, walls, bulletOut, spawnList, allEnemies, particles, room){
    this.anim+=dt; this.battleTime+=dt;
    if(this.hitFlash>0) this.hitFlash-=dt;
    if(this.damageCooldown>0) this.damageCooldown-=dt;
    this.glitchTimer+=dt;
    // Diálogo inicial: quando vê jogador pela primeira vez, fala e inicia batalha
    if(!this.dialogShown){
      if(dist(this.x,this.y, player.x, player.y) < 360){
        this.dialogShown=true;
        this.dialogTimer=HACKER_DIALOG_TIME;
        if(room) room.hackerDialogActive=true;
        // diálogo flutuante será desenhado por Room ou Game
        if(typeof window!=='undefined' && window.game && window.game.showToast) window.game.showToast('「Fui eu que contaminei seu código com o Dark Vírus!」', 2400);
        for(let k=0;k<16;k++) particles.push(new Particle(this.x, this.y-8, randRange(-1.4,1.4), randRange(-1.6,0.4), 420, '#00ff88', 2));
        // glitch explosion
        if(room) room.explosions.push({x:this.x,y:this.y,radius:12,life:380,max:380,isHackerGlitch:true});
      } else {
        // levita leve até ver
        this.y += Math.sin(this.anim*0.003)*0.3;
        return;
      }
    }
    if(this.dialogTimer>0){
      this.dialogTimer-=dt;
      if(this.dialogTimer<=0){
        this.battleStarted=true;
        if(room) room.hackerDialogActive=false;
        if(room) room.hackerBattleStarted=true;
        this.shootTimer=600;
      } else {
        return; // pausa até terminar diálogo
      }
    }
    if(!this.battleStarted) return;
    if(this.dead){
      this.victoryTimer+=dt;
      if(this.victoryTimer<2200 && Math.random()<0.42){
        particles.push(new Particle(this.x+randRange(-14,14), this.y+randRange(-10,10), randRange(-1.2,1.2), randRange(-1.4,0.4), 420, ['#00ff88','#00e5ff','#ff0040','#ffcc00'][randInt(0,3)], 2.2));
      }
      return;
    }
    const phase=this.getPhase();
    this.phase=phase;
    this.enrage=clamp(this.battleTime/80000,0,0.22);
    // car state machine tem prioridade máxima (fase 3)
    if(this.carState!=='idle'){
      this.updateCar(dt, player, walls, particles, room);
      return;
    }
    if(this.isDashing){
      this.dashTime-=dt;
      const nx=this.x + this.dashDir.x * HACKER_DASH_SPEED * (1+this.enrage*0.25);
      const ny=this.y + this.dashDir.y * HACKER_DASH_SPEED * (1+this.enrage*0.25);
      let hitWall=false;
      if(this.collidesWalls(nx,this.y,walls)) hitWall=true; else this.x=nx;
      if(this.collidesWalls(this.x,ny,walls)) hitWall=true; else this.y=ny;
      this.x=clamp(this.x, WALL_THICK+this.w/2, CANVAS_W-WALL_THICK-this.w/2);
      this.y=clamp(this.y, WALL_THICK+this.h/2, CANVAS_H-WALL_THICK-this.h/2);
      // dano durante dash
      if(rectCollide(player.x-player.w/2,player.y-player.h/2,player.w,player.h,this.x-this.w/2,this.y-this.h/2,this.w,this.h)){
        if(!player.isInvulnerable() && this.canDamage()){
          if(player.takeDamage(1)){
            for(let k=0;k<8;k++) particles.push(new Particle(player.x,player.y, randRange(-1.8,1.8), randRange(-1.6,0.6), 260, '#00ff88',2));
          }
          this.resetDamageCooldown();
          const ang=Math.atan2(player.y-this.y, player.x-this.x);
          player.x+=Math.cos(ang)*12; player.y+=Math.sin(ang)*12;
        }
      }
      if(this.dashTime<=0 || hitWall){
        this.isDashing=false;
        this.dashCooldown=HACKER_DASH_COOLDOWN * (1 - this.enrage*0.22) + randRange(-200,300);
        this.dashPrep=0;
        for(let k=0;k<10;k++) particles.push(new Particle(this.x,this.y, randRange(-1.4,1.4), randRange(-1.2,0.6), 240, '#00ff88',1.6));
      }
      return;
    }
    if(this.dashPrep>0){
      this.dashPrep-=dt;
      if(this.dashPrep<=0){
        this.isDashing=true;
        this.dashTime=HACKER_DASH_DURATION;
      }
      return;
    }
    // Movimento base: segue jogador com leve evasão, exceto fase 4 (gruda)
    let moveSpeed=this.speed * (1+this.enrage*0.4);
    if(phase===4) moveSpeed*=1.35;
    else if(phase===3) moveSpeed*=1.12;
    // Atualiza timers sempre mas filtra por fase
    if(this.shootTimer>0) this.shootTimer-=dt;
    if(this.dashCooldown>0) this.dashCooldown-=dt;
    if(this.bazookaTimer>0) this.bazookaTimer-=dt;
    if(this.summonTimer>0) this.summonTimer-=dt;
    if(this.healTimer>0) this.healTimer-=dt;
    if(this.carCooldown>0 && phase===3) this.carCooldown-=dt;
    if(this.punchTimer>0) this.punchTimer-=dt;

    // FASE 1: tiros normais + dash
    if(phase===1){
      // persegue levemente
      const dx=player.x-this.x, dy=player.y-this.y, d=Math.hypot(dx,dy)||1;
      if(d>28){
        const nx=this.x + (dx/d)*moveSpeed*0.62;
        const ny=this.y + (dy/d)*moveSpeed*0.62;
        if(!this.collidesWalls(nx,this.y,walls)) this.x=nx;
        if(!this.collidesWalls(this.x,ny,walls)) this.y=ny;
      } else {
        this.x += Math.sin(this.anim*0.004)*0.6;
        this.y += Math.cos(this.anim*0.004)*0.6;
      }
      if(this.shootTimer<=0){
        const dir=normalize(player.x-this.x, player.y-this.y);
        const spread=randRange(-0.08,0.08);
        const ang=Math.atan2(dir.y,dir.x)+spread;
        bulletOut.push(new Bullet(this.x,this.y, Math.cos(ang), Math.sin(ang), 'enemy', {
          speed:HACKER_BULLET_SPEED*(1+this.enrage*0.18),
          damage:HACKER_BULLET_DAMAGE,
          range:420,
          size:HACKER_BULLET_SIZE,
          color:'#00ff88',
          glow:'rgba(0,255,136,0.32)'
        }));
        this.shootTimer=HACKER_SHOOT_COOLDOWN_P1 * (1 - this.enrage*0.14);
        for(let k=0;k<3;k++) particles.push(new Particle(this.x,this.y, Math.cos(ang)*randRange(0.6,1.4), Math.sin(ang)*randRange(0.6,1.4), 160, '#00ff88',1.4));
      }
      if(this.dashCooldown<=0 && Math.random()<0.014){
        const dir=normalize(player.x-this.x, player.y-this.y);
        this.dashDir=dir; this.dashPrep=HACKER_DASH_PREP;
        this.dashCooldown=99999;
      }
      // glitch code particles
      if(Math.random()<0.18){
        particles.push(new Particle(this.x+randRange(-12,12), this.y+randRange(-8,8), randRange(-0.6,0.6), -0.8, 360, 'rgba(0,255,136,0.85)',1.2));
      }
    }
    // FASE 2: bazuca + summon
    else if(phase===2){
      const dx=player.x-this.x, dy=player.y-this.y, d=Math.hypot(dx,dy)||1;
      if(d<110){
        const dir=normalize(this.x-player.x, this.y-player.y);
        const nx=this.x + dir.x*moveSpeed*0.7;
        const ny=this.y + dir.y*moveSpeed*0.7;
        if(!this.collidesWalls(nx,this.y,walls)) this.x=nx;
        if(!this.collidesWalls(this.x,ny,walls)) this.y=ny;
      } else if(d>180){
        const dir=normalize(dx,dy);
        const nx=this.x + dir.x*moveSpeed*0.55;
        const ny=this.y + dir.y*moveSpeed*0.55;
        if(!this.collidesWalls(nx,this.y,walls)) this.x=nx;
        if(!this.collidesWalls(this.x,ny,walls)) this.y=ny;
      } else {
        this.x+=Math.sin(this.anim*0.003)*0.7;
      }
      if(this.bazookaTimer<=0){
        const dir=normalize(player.x-this.x, player.y-this.y);
        bulletOut.push(new Bullet(this.x,this.y, dir.x, dir.y, 'enemy', {
          speed:HACKER_BAZOOKA_SPEED,
          damage:HACKER_BAZOOKA_DAMAGE,
          range:520,
          size:7,
          color:'#ff0040',
          glow:'rgba(255,0,64,0.34)',
          isBazuca:true,
          explosionRadius:HACKER_BAZOOKA_RADIUS,
          explosionDamage:HACKER_BAZOOKA_DAMAGE
        }));
        this.bazookaTimer=HACKER_BAZOOKA_COOLDOWN * (1 - this.enrage*0.16);
        for(let k=0;k<8;k++) particles.push(new Particle(this.x,this.y, dir.x*randRange(0.6,1.8)+randRange(-0.6,0.6), dir.y*randRange(0.6,1.8)+randRange(-0.6,0.6), 280, '#ff0040',2));
        if(room) room.shake=Math.max(room.shake||0, 48);
      }
      if(this.summonTimer<=0){
        let sx,sy,tries=0;
        do{
          sx=randRange(CANVAS_W*0.22, CANVAS_W*0.78); sy=randRange(CANVAS_H*0.34, CANVAS_H*0.78); tries++;
          let onWall=false; for(const w of walls) if(rectCollide(sx-14,sy-14,28,28,w.x,w.y,w.w,w.h)) {onWall=true;break;}
          if(!onWall && dist(sx,sy,player.x,player.y)>70 && dist(sx,sy,this.x,this.y)>70) break;
        }while(tries<14);
        const roll=Math.random();
        let e;
        if(roll<0.4) e=new Chaser(sx,sy);
        else if(roll<0.65) e=new Fugitive(sx,sy);
        else if(roll<0.85) e=new Kamikaze(sx,sy);
        else e=new DashEnemy(sx,sy);
        e.hp=Math.max(1, Math.floor(e.maxHp*0.85)); e.maxHp=e.hp;
        e.isSummoned=true;
        applyEnemyVariation(e, Math.random, 3);
        spawnList.push(e);
        for(let k=0;k<10;k++) particles.push(new Particle(sx,sy, randRange(-1.2,1.2), randRange(-1.2,0.6), 300, '#ff0040',1.8));
        this.summonTimer=HACKER_SUMMON_COOLDOWN_P2 + randRange(-400,500);
      }
      if(this.dashCooldown<=0 && Math.random()<0.016){
        const dir=normalize(player.x-this.x, player.y-this.y);
        this.dashDir=dir; this.dashPrep=HACKER_DASH_PREP;
        this.dashCooldown=99999;
      }
      // glitch
      if(Math.random()<0.22) particles.push(new Particle(this.x+randRange(-14,14), this.y-10+randRange(-6,6), randRange(-0.7,0.7), -0.9, 300, '#ff0040',1.4));
    }
    // FASE 3: summon + cura + carro
    else if(phase===3){
      // movimento evasivo em 8
      const dx=player.x-this.x, dy=player.y-this.y;
      const perp=Math.sin(this.anim*0.002)*1.1;
      this.x += (-dy/(Math.hypot(dx,dy)||1))*perp*0.5 + (dx/(Math.hypot(dx,dy)||1))*moveSpeed*0.32;
      this.y += (dx/(Math.hypot(dx,dy)||1))*perp*0.5 + (dy/(Math.hypot(dx,dy)||1))*moveSpeed*0.18;
      this.x=clamp(this.x, WALL_THICK+this.w/2, CANVAS_W-WALL_THICK-this.w/2);
      this.y=clamp(this.y, WALL_THICK+this.h/2, CANVAS_H-WALL_THICK-this.h/2);
      if(this.summonTimer<=0){
        let sx,sy,tries=0;
        do{
          sx=randRange(CANVAS_W*0.22, CANVAS_W*0.78); sy=randRange(CANVAS_H*0.34, CANVAS_H*0.78); tries++;
          let onWall=false; for(const w of walls) if(rectCollide(sx-14,sy-14,28,28,w.x,w.y,w.w,w.h)) {onWall=true;break;}
          if(!onWall && dist(sx,sy,player.x,player.y)>68) break;
        }while(tries<14);
        const roll=Math.random();
        let e;
        if(roll<0.35) e=new Chaser(sx,sy);
        else if(roll<0.60) e=new Kamikaze(sx,sy);
        else if(roll<0.80) e=new Fugitive(sx,sy);
        else e=new Summoner(sx,sy);
        e.hp=Math.max(1, Math.floor(e.maxHp*0.9)); e.maxHp=e.hp;
        e.isSummoned=true;
        applyEnemyVariation(e, Math.random, 3);
        spawnList.push(e);
        for(let k=0;k<10;k++) particles.push(new Particle(sx,sy, randRange(-1.2,1.2), randRange(-1.2,0.6), 300, '#c084fc',1.8));
        this.summonTimer=HACKER_SUMMON_COOLDOWN_P3 + randRange(-300,400);
      }
      if(this.healTimer<=0){
        // spawna item de cura pequeno no chão perto do hacker (para atrair jogador)
        let hx=this.x+randRange(-42,42), hy=this.y+randRange(-32,32), tries=0;
        while(tries<10){
          let onWall=false; for(const w of walls) if(rectCollide(hx-10,hy-10,20,20,w.x,w.y,w.w,w.h)) {onWall=true;break;}
          if(!onWall) break;
          hx=this.x+randRange(-52,52); hy=this.y+randRange(-42,42); tries++;
        }
        hx=clamp(hx, WALL_THICK+20, CANVAS_W-WALL_THICK-20);
        hy=clamp(hy, WALL_THICK+20, CANVAS_H-WALL_THICK-20);
        const healAmt=Math.random()<0.7?1:2;
        const it=new HealingItem(hx,hy,healAmt);
        it.spawnDelay=320;
        if(room && room.items) room.items.push(it);
        for(let k=0;k<10;k++) particles.push(new Particle(hx,hy, randRange(-1,1), -0.8, 420, '#4ade80',1.6));
        this.healTimer=HACKER_HEAL_SPAWN_COOLDOWN + randRange(-600,800);
      }
      // carro
      if(this.carCooldown<=0 && this.carState==='idle'){
        this.carState='prep';
        this.carTimer=HACKER_CAR_PREP_TIME;
        this.carY=player.y;
        this.carDir=player.x < CANVAS_W/2 ? 1 : -1; // vem do lado oposto ao jogador para atropelar
        // aviso glitch na borda
        for(let k=0;k<18;k++) particles.push(new Particle(this.carDir===1?WALL_THICK+12:CANVAS_W-WALL_THICK-12, this.carY+randRange(-12,12), randRange(-0.6,0.6), randRange(-0.6,0.6), 520, '#ffcc00',1.8));
        if(room) room.shake=Math.max(room.shake||0, 42);
        // some da tela
        this.x = this.carDir===1 ? -30 : CANVAS_W+30;
        this.y = this.carY;
      }
      if(this.dashCooldown<=0 && this.carState==='idle' && Math.random()<0.012){
        const dir=normalize(player.x-this.x, player.y-this.y);
        this.dashDir=dir; this.dashPrep=HACKER_DASH_PREP;
        this.dashCooldown=99999;
      }
      if(Math.random()<0.28){
        const glitchCol=HACKER_ROOM_GLITCH_COLORS[randInt(0,HACKER_ROOM_GLITCH_COLORS.length-1)];
        particles.push(new Particle(this.x+randRange(-16,16), this.y+randRange(-12,12), randRange(-0.8,0.8), -0.7, 340, glitchCol,1.5));
      }
    }
    // FASE 4: só socos melee
    else {
      const dx=player.x-this.x, dy=player.y-this.y, d=Math.hypot(dx,dy)||1;
      // gruda no jogador
      if(d>14){
        const nx=this.x + (dx/d)*moveSpeed;
        const ny=this.y + (dy/d)*moveSpeed;
        if(!this.collidesWalls(nx,this.y,walls)) this.x=nx;
        if(!this.collidesWalls(this.x,ny,walls)) this.y=ny;
      }
      this.x=clamp(this.x, WALL_THICK+this.w/2, CANVAS_W-WALL_THICK-this.w/2);
      this.y=clamp(this.y, WALL_THICK+this.h/2, CANVAS_H-WALL_THICK-this.h/2);
      if(this.punchTimer<=0 && d < HACKER_PUNCH_RANGE + 6){
        // cria soco melee curta distância (usa Room melee? mas hacker causa dano direto)
        if(!player.isInvulnerable()){
          let punchDamage=HACKER_PUNCH_DAMAGE;
          // variação de dano: 10% chance de 1.5 coração extra?
          if(player.takeDamage(punchDamage)){
            for(let k=0;k<9;k++) particles.push(new Particle(player.x,player.y, randRange(-2,2), randRange(-2,0.4), 260, '#ff0040',2));
            const ang=Math.atan2(player.y-this.y, player.x-this.x);
            player.x+=Math.cos(ang)*14; player.y+=Math.sin(ang)*14;
          }
        }
        this.punchTimer=HACKER_PUNCH_COOLDOWN;
        for(let k=0;k<8;k++) particles.push(new Particle(this.x + (dx/d)*16, this.y + (dy/d)*16, (dx/d)*randRange(1,2)+randRange(-0.6,0.6), (dy/d)*randRange(1,2)+randRange(-0.6,0.6), 180, '#ff0040',1.8));
        // shake e som
        if(room) room.shake=Math.max(room.shake||0, 52);
      }
      // em rage, soca mais rápido
      if(this.punchTimer>0) this.punchTimer-=dt;
      // glitch frenético fase 4
      if(Math.random()<0.32) particles.push(new Particle(this.x+randRange(-14,14), this.y+randRange(-12,12), randRange(-1,1), randRange(-1,0.6), 240, '#ff0040',1.6));
    }

    // dano por contato genérico (todas as fases)
    if(rectCollide(player.x-player.w/2,player.y-player.h/2,player.w,player.h, this.x-this.w/2,this.y-this.h/2,this.w,this.h)){
      if(!player.isInvulnerable() && this.canDamage()){
        let contactDamage=1;
        if(phase===3) contactDamage=2;
        else if(phase===4) contactDamage=1; // já tem soco, contato menor
        if(player.takeDamage(contactDamage)){
          for(let k=0;k<8;k++) particles.push(new Particle(player.x,player.y, randRange(-1.8,1.8), randRange(-1.6,0.6), 260, phase===4?'#ff0040':'#00ff88',2));
        }
        this.resetDamageCooldown();
      }
    }
    // emissões de código/glitch periódicas
    this.lastCodeParticle+=dt;
    if(this.lastCodeParticle>120){
      this.lastCodeParticle=0;
      const ch=this.codeChars[randInt(0,this.codeChars.length-1)];
      particles.push(new Particle(this.x+randRange(-18,18), this.y-14, randRange(-0.4,0.4), -1.2, 420, 'rgba(0,255,136,0.9)',1.1));
      // desenha char como partícula? partícula simples já basta
    }
  }
  updateCar(dt, player, walls, particles, room){
    this.carTimer-=dt;
    if(this.carState==='prep'){
      if(this.carTimer<=0){
        this.carState='charging';
        this.carTimer=HACKER_CAR_DURATION;
        this.carX=this.x;
        // direção já definida
        // velocidade alta
        for(let k=0;k<22;k++) particles.push(new Particle(this.x, this.y, this.carDir*randRange(2,5)+randRange(-0.6,0.6), randRange(-1.2,1.2), 360, '#ffcc00',2.2));
        if(room) room.shake=Math.max(room.shake||0, 110);
      } else {
        // pisca aviso na borda
        if(Math.floor(this.carTimer/80)%2===0){
          particles.push(new Particle(this.carDir===1?WALL_THICK+8:CANVAS_W-WALL_THICK-8, this.carY, randRange(-0.6,0.6), randRange(-0.6,0.6), 160, '#ffcc00',1.6));
        }
        // desenha linha tracejada de aviso (room draw cuidará)
      }
    } else if(this.carState==='charging'){
      this.x += this.carDir * HACKER_CAR_SPEED;
      // rastro carro
      if(Math.random()<0.7) particles.push(new Particle(this.x - this.carDir*12, this.y+randRange(-6,6), -this.carDir*randRange(1,2), randRange(-0.5,0.5), 220, 'rgba(255,204,0,0.9)',2));
      if(Math.random()<0.45) particles.push(new Particle(this.x, this.y+randRange(-8,8), randRange(-1,1), randRange(-1,1), 180, 'rgba(0,255,136,0.85)',1.4));
      // dano atropelo contínuo (2.5 corações)
      if(rectCollide(player.x-player.w/2,player.y-player.h/2,player.w,player.h, this.x-this.w/2-8, this.y-this.h/2-6, this.w+16,this.h+12)){
        if(!player.isInvulnerable()){
          if(player.takeDamage(HACKER_CAR_DAMAGE)){
            for(let k=0;k<14;k++) particles.push(new Particle(player.x,player.y, this.carDir*randRange(1.5,3.5)+randRange(-1,1), randRange(-1.8,1.2), 320, '#ffcc00',2.5));
            player.x += this.carDir*22;
            player.x=clamp(player.x, WALL_THICK+player.w/2, CANVAS_W-WALL_THICK-player.w/2);
          }
        }
      }
      if(this.carTimer<=0 || this.x < -50 || this.x > CANVAS_W+50){
        this.carState='recover';
        this.carTimer=600;
        // volta ao centro com glitch
        this.x = CANVAS_W/2 + randRange(-32,32);
        this.y = CANVAS_H/2 + randRange(-18,18);
        for(let k=0;k<18;k++) particles.push(new Particle(this.x,this.y, randRange(-1.6,1.6), randRange(-1.6,0.6), 300, '#00ff88',1.8));
      }
    } else if(this.carState==='recover'){
      if(this.carTimer<=0){
        this.carState='idle';
        this.carCooldown=HACKER_CAR_COOLDOWN * (1 - this.enrage*0.18) + randRange(-800,1000);
      }
    }
  }
  draw(ctx){
    const x=this.x-this.w/2, y=this.y-this.h/2;
    const isFlash=this.hitFlash>0 && Math.floor(this.hitFlash/40)%2===0;
    const bob=Math.sin(this.anim*0.008)*1.6;
    const phase=this.getPhase();
    // glitch aura Dark Vírus
    const glitchPulse=0.5+Math.sin(this.anim*0.014)*0.32 + this.enrage*0.14;
    if(this.battleStarted && !this.dead){
      // aura glitch multicor
      const col= phase===4?'#ff0040': phase===3?'#c084fc': phase===2?'#ff0040': '#00ff88';
      const alpha = 0.12 + glitchPulse*0.10;
      ctx.fillStyle=col.replace(')', `,${alpha})`).replace('rgb','rgba');
      // fallback hex to rgba
      let bgCol='rgba(0,255,136,0.14)';
      if(phase===2) bgCol=`rgba(255,0,64,${alpha})`;
      else if(phase===3) bgCol=`rgba(192,132,252,${alpha})`;
      else if(phase===4) bgCol=`rgba(255,0,64,${alpha*1.2})`;
      ctx.fillStyle=bgCol;
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*1.02+glitchPulse*5,0,Math.PI*2); ctx.fill();
      // anel glitch
      ctx.strokeStyle= phase===4?`rgba(255,0,64,${0.45+glitchPulse*0.2})`:`rgba(0,255,136,${0.38+glitchPulse*0.18})`;
      ctx.lineWidth=1.6;
      ctx.setLineDash([4,3]);
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*1.08,0,Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
      // código matrix chuva ao redor
      if(Math.random()<0.22){
        ctx.fillStyle='rgba(0,255,136,0.92)'; ctx.font='7px monospace'; ctx.textAlign='center';
        ctx.fillText(this.codeChars[randInt(0,this.codeChars.length-1)], this.x+randRange(-16,16), this.y-12+bob+Math.sin(this.anim*0.02)*2);
        ctx.textAlign='left';
      }
    }
    // car aviso linha
    if(this.carState==='prep'){
      const prog=1 - (this.carTimer/HACKER_CAR_PREP_TIME);
      ctx.fillStyle='rgba(0,0,0,0.22)'; ctx.fillRect(WALL_THICK, this.carY-10, CANVAS_W-WALL_THICK*2, 20);
      ctx.strokeStyle=`rgba(255,204,0,${0.42+prog*0.38})`; ctx.lineWidth=2; ctx.setLineDash([6,4]);
      ctx.beginPath(); ctx.moveTo(this.x, this.y+bob); ctx.lineTo(this.carDir===1?CANVAS_W-WALL_THICK-8:WALL_THICK+8, this.carY); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle=`rgba(255,204,0,${0.65+prog*0.25})`; ctx.font='6px "Press Start 2P"'; ctx.textAlign='center';
      ctx.fillText('CARRO!', this.carDir===1?CANVAS_W-WALL_THICK-30:WALL_THICK+30, this.carY-16); ctx.textAlign='left';
      // barra prep
      ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(x, y-8+bob, this.w, 3);
      ctx.fillStyle='#ffcc00'; ctx.fillRect(x, y-8+bob, this.w*prog, 3);
    }
    // car visual quando charging - desenha carro atrás do hacker
    if(this.carState==='charging'){
      const carW=42, carH=18;
      const carX=this.x - carW/2, carY=this.y - carH/2 + bob;
      // sombra carro
      ctx.fillStyle='rgba(0,0,0,0.34)'; ctx.fillRect(carX+2, carY+carH-2, carW, 4);
      ctx.fillStyle='#2a2a2e'; ctx.fillRect(carX, carY, carW, carH);
      ctx.fillStyle='#ffcc00'; ctx.fillRect(carX+2, carY+2, carW-4, 3);
      ctx.fillStyle='#1a1a1a'; ctx.fillRect(carX+4, carY+7, carW-8, 5);
      // farol
      ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(carX+carW-6, carY+5, 3,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(carX+carW-6, carY+5, 7,0,Math.PI*2); ctx.fill();
      // rastro velocidade
      ctx.fillStyle='rgba(255,204,0,0.18)'; ctx.fillRect(carX - this.carDir*18, carY+2, 18, carH-4);
    }
    // sombra base
    ctx.fillStyle='rgba(0,0,0,0.32)'; ctx.fillRect(x+2, y+this.h-3, this.w, 3);
    // diálogo
    if(this.dialogTimer>0){
      const prog=1 - (this.dialogTimer/HACKER_DIALOG_TIME);
      ctx.fillStyle='rgba(0,0,0,0.82)'; ctx.fillRect(x-38, y-36+bob, this.w+76, 26);
      ctx.strokeStyle='rgba(0,255,136,0.42)'; ctx.lineWidth=1.5; ctx.strokeRect(x-38, y-36+bob, this.w+76, 26);
      ctx.fillStyle='#00ff88'; ctx.font='6px "Press Start 2P"'; ctx.textAlign='center';
      const txt='\"Fui eu que contaminei';
      const txt2=' seu código com o Dark Vírus!\"';
      ctx.fillText(txt, this.x, y-26+bob); ctx.fillText(txt2, this.x, y-18+bob); ctx.textAlign='left';
      // glitch no texto
      if(Math.random()<0.28){
        ctx.fillStyle='rgba(255,0,64,0.85)'; ctx.font='5px monospace'; ctx.textAlign='center';
        ctx.fillText('▓▒█ Dark Vírus █▒▓', this.x+randRange(-1,1), y-18+bob+randRange(-1,1)); ctx.textAlign='left';
      }
    }
    // corpo Hacker - base Neutro mas corrompido
    // pernas
    if(this.dead){
      ctx.fillStyle='#2a1a1a'; ctx.fillRect(x+4, y+16+bob, 6, 4); ctx.fillRect(x+14, y+16+bob, 6, 4);
    } else {
      ctx.fillStyle='#1a2a2a'; ctx.fillRect(x+4, y+16+bob, 6, 6); ctx.fillRect(x+14, y+16+bob, 6, 6);
      if(phase===4 && Math.floor(this.anim/120)%2===0){
        ctx.fillStyle='rgba(255,0,64,0.22)'; ctx.fillRect(x+2, y+10+bob, this.w-4, this.h-6);
      }
    }
    // torso - jaqueta hacker com glitch verde
    let torsoCol=isFlash?'#fff': this.dead?'#1a1a1a': phase===4?'#3a0a0a': phase===3?'#2a1a3a': phase===2?'#1a2a1a':'#1e2e2e';
    ctx.fillStyle=torsoCol; ctx.fillRect(x+3, y+8+bob, 18, 10);
    // detalhe neutro corrompido - capuz/código
    ctx.fillStyle=isFlash?'#aaffcc': phase===3?'#c084fc': phase===2?'#ff0040':'#00ff88';
    ctx.fillRect(x+5, y+9+bob, 14, 1.5);
    ctx.fillRect(x+8, y+12+bob, 8, 1);
    // braços
    ctx.fillStyle=isFlash?'#fff': phase===4?'#ff0040':'#e0ffe8';
    ctx.fillRect(x, y+10+bob, 4, 6); ctx.fillRect(x+20, y+10+bob, 4, 6);
    // efeito pochita? não
    // cabeça - Neutro corrompido com máscara glitch
    if(this.dead){
      ctx.fillStyle='#0a0a0a'; ctx.fillRect(x+5, y+1+bob, 14, 11);
      ctx.fillStyle='#ff0040'; ctx.font='7px monospace'; ctx.textAlign='center'; ctx.fillText('X X', this.x, y+8+bob); ctx.textAlign='left';
      ctx.fillStyle='rgba(255,0,64,0.55)'; ctx.fillRect(x+5, y+10+bob, 14, 1);
    } else {
      ctx.fillStyle='#f0e8d8'; ctx.fillRect(x+5, y+1+bob, 14, 11);
      // cabelo/glitch topo
      ctx.fillStyle= isFlash?'#fff': phase===3?'#c084fc': '#1a1a2e';
      ctx.fillRect(x+5, y+1+bob, 14, 4);
      // óculos hacker verde
      ctx.fillStyle='#0a1a12'; ctx.fillRect(x+6, y+5+bob, 12, 5);
      ctx.fillStyle='#00ff88'; ctx.fillRect(x+7, y+6+bob, 4, 3); ctx.fillRect(x+13, y+6+bob, 4, 3);
      // reflexo
      ctx.fillStyle='#ffffff'; ctx.fillRect(x+8, y+7+bob, 1,1); ctx.fillRect(x+14, y+7+bob, 1,1);
      // glitch linhas
      if(Math.random()<0.32){
        ctx.fillStyle='rgba(255,0,64,0.65)'; ctx.fillRect(x+5, y+6+bob+randRange(0,4), 14, 1);
      }
      if(Math.random()<0.18){
        ctx.fillStyle='rgba(0,255,136,0.72)'; ctx.fillRect(x+6, y+9+bob, 12, 1);
      }
      // boca glitch
      ctx.fillStyle=phase===4?'#ff0040':'#1a2a1a';
      ctx.fillRect(x+10, y+11+bob, 4, 1.5);
      if(phase===4) ctx.fillRect(x+9, y+10+bob, 6, 1);
    }
    // punhos fase 4 - luvas vermelhas
    if(phase===4 && !this.dead){
      const side=Math.floor(this.anim/180)%2===0 ? -1 : 1;
      ctx.fillStyle='#ff0040'; ctx.beginPath(); ctx.arc(this.x + side*9, this.y+10+bob, 4.2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#ff6b6b'; ctx.beginPath(); ctx.arc(this.x + side*9, this.y+10+bob, 2.4,0,Math.PI*2); ctx.fill();
    }
    // motosserra lateral se tem? não, hacker não tem
    // barra vida hacker com glitch
    const hpPct=clamp(this.hp/this.maxHp,0,1);
    const barW=this.w+14, barX=x-7, barY=y-14+bob;
    ctx.fillStyle='rgba(0,0,0,0.78)'; ctx.fillRect(barX, barY, barW, 6);
    // glitch preenchimento
    const colPhase= phase===1?'#00ff88': phase===2?'#ff0040': phase===3?'#c084fc': '#ff0040';
    ctx.fillStyle=hpPct>0.5?colPhase:hpPct>0.25?'#ff8c42':'#ef4444';
    // efeito glitch barra (corta)
    const glitchCut= Math.floor(this.anim/90)%2===0 && hpPct<0.5 ? 4 : 0;
    ctx.fillRect(barX, barY, (barW-glitchCut)*hpPct, 6);
    ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=1; ctx.strokeRect(barX, barY, barW, 6);
    // marcadores fases
    const m75X=barX+barW*0.75, m50X=barX+barW*0.50, m10X=barX+barW*0.10;
    ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.fillRect(m75X, barY,1,6); ctx.fillRect(m50X, barY,1,6);
    ctx.fillStyle='rgba(255,0,64,0.85)'; ctx.fillRect(m10X, barY,1,6);
    ctx.fillStyle='#fff'; ctx.font='4px monospace'; ctx.textAlign='center';
    ctx.fillText('75', m75X, barY-3); ctx.fillText('50', m50X, barY-3); ctx.fillText('10', m10X, barY-3); ctx.textAlign='left';
    ctx.fillStyle='#fff'; ctx.font='5px "Press Start 2P"'; ctx.textAlign='center';
    ctx.fillText(`HACKER ${this.getPhaseName()}`, this.x, y-18+bob); ctx.textAlign='left';
    // dash prep linha
    if(this.dashPrep>0){
      const p=1 - (this.dashPrep/HACKER_DASH_PREP);
      ctx.strokeStyle=`rgba(0,255,136,${0.42+p*0.38})`; ctx.lineWidth=1.6; ctx.setLineDash([4,3]);
      ctx.beginPath(); ctx.moveTo(this.x, this.y+bob); ctx.lineTo(this.x+this.dashDir.x*84, this.y+bob+this.dashDir.y*84); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle=`rgba(255,255,255,${0.75+p*0.2})`; ctx.font='6px monospace'; ctx.textAlign='center';
      ctx.fillText('>>', this.x+this.dashDir.x*42, this.y+bob+this.dashDir.y*42); ctx.textAlign='left';
    }
    // vitória
    if(this.dead){
      const t=clamp(this.victoryTimer/900,0,1);
      ctx.fillStyle=`rgba(255,255,255,${t*0.38})`; ctx.fillRect(x-8, y-8+bob, this.w+16, this.h+16);
      if(t>0.55){
        ctx.fillStyle=`rgba(0,255,136,${(t-0.55)*1.1})`; ctx.beginPath(); ctx.arc(this.x, this.y+bob, 18+t*14,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#fff'; ctx.font='6px "Press Start 2P"'; ctx.textAlign='center'; ctx.fillText('DERROTADO', this.x, y-22+bob); ctx.textAlign='left';
      }
    }
  }
  getRect(){ return {x:this.x-this.w/2,y:this.y-this.h/2,w:this.w,h:this.h}; }
}

// ===================== BULLET =====================
class Bullet {
  constructor(x, y, dirX, dirY, owner = 'player', opts = {}) {
    this.x = x; this.y = y;
    this.dirX = dirX; this.dirY = dirY;
    // configurável por arma
    this.speed = opts.speed ?? BULLET_SPEED;
    this.damage = opts.damage ?? BULLET_DAMAGE;
    this.range = opts.range ?? BULLET_RANGE;
    this.size = opts.size ?? BULLET_SIZE;
    this.color = opts.color ?? (owner==='enemy' ? '#ff6bff' : '#ffeb3b');
    this.glow = opts.glow ?? (owner==='enemy' ? 'rgba(255,107,255,0.25)' : 'rgba(255, 220, 80, 0.25)');
    this.pierce = !!opts.pierce; // raio atravessa inimigos
    this.chain = opts.chain||0; // cadeia elétrica (upgrade RAIO muito raro)
    this.pierceCount = opts.pierceCount ?? (opts.pierce ? 999 : 0); // 999 = infinito para RAIO, 1-3 para pistola
    this.isBazuca = !!opts.isBazuca; // bazuca explode em área
    this.isArrow = !!opts.isArrow; // arco simples
    this.isSwordWave = !!opts.isSwordWave; // corte de vento da espada
    this.isRayMatematico = !!opts.isRayMatematico; // Dev principal
    this.isMiniRay = !!opts.isMiniRay; // Sobremesa mini
    this.explosionRadius = opts.explosionRadius ?? 96;
    this.explosionDamage = opts.explosionDamage ?? 4;
    this.hitEnemies = new Set(); // para pierce não acertar mesmo inimigo múltiplas vezes
    this.traveled = 0;
    this.owner = owner;
    this.dead = false;
  }
  update(dt, walls) {
    const dx = this.dirX * this.speed;
    const dy = this.dirY * this.speed;
    this.x += dx;
    this.y += dy;
    this.traveled += Math.hypot(dx, dy);
    if (this.traveled > this.range) this.dead = true;
    for (const w of walls) {
      if (circleRectCollide(this.x, this.y, this.size, w.x, w.y, w.w, w.h)) {
        this.dead = true; break;
      }
    }
    if (this.x < -20 || this.x > CANVAS_W + 20 || this.y < -20 || this.y > CANVAS_H + 20) this.dead = true;
  }
  draw(ctx) {
    // Dev - Mini Raio Sobremesa (pequeno, laranja rápido)
    if(this.isMiniRay){
      const ang=Math.atan2(this.dirY,this.dirX);
      // rastro curto laranja
      ctx.strokeStyle=this.glow;
      ctx.lineWidth=this.size+3;
      ctx.lineCap='round';
      ctx.globalAlpha=0.62;
      ctx.beginPath();
      ctx.moveTo(this.x - this.dirX*10, this.y - this.dirY*10);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
      ctx.globalAlpha=1;
      // corpo mini
      ctx.fillStyle=this.glow;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.size+3,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=this.color;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.size,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#ffffff';
      ctx.beginPath(); ctx.arc(this.x, this.y, 1.1,0,Math.PI*2); ctx.fill();
      // faísca ponta
      ctx.fillStyle='rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(this.x+Math.cos(ang)*4, this.y+Math.sin(ang)*4, 1.0,0,Math.PI*2); ctx.fill();
      return;
    }
    // Dev - Raio Matemático principal - AZAZEL BRIMSTONE AZUL (inspirado, não cópia)
    // Visual original: feixe grosso contínuo estilo Brimstone, paleta azul (outer dark, mid, inner branco-azulado)
    // Evita sprites protegidos: geometria procedural com camadas, ondulação e partículas
    if(this.isRayMatematico){
      const ang=Math.atan2(this.dirY,this.dirX);
      const t = Date.now()*0.009 + this.traveled*0.05;
      // Comprimento do feixe (Azazel é contínuo, aqui simulamos rastro longo)
      const beamLen = 28;
      const bx0 = this.x - this.dirX*beamLen;
      const by0 = this.y - this.dirY*beamLen;
      // Ondulação sutil nas bordas (efeito demoníaco orgânico)
      const wave = Math.sin(t*1.8)*1.1;
      const wave2 = Math.cos(t*2.2)*0.9;
      // Camada 1: sombra/outer escuro azul-negro (contorno Azazel)
      ctx.strokeStyle='rgba(4,18,38,0.95)';
      ctx.lineWidth=this.size*2.8 + 7;
      ctx.lineCap='round';
      ctx.lineJoin='round';
      ctx.globalAlpha=0.95;
      ctx.beginPath();
      ctx.moveTo(bx0 + Math.cos(ang+Math.PI/2)*wave*0.6, by0 + Math.sin(ang+Math.PI/2)*wave*0.6);
      ctx.lineTo(this.x + Math.cos(ang+Math.PI/2)*wave*0.6, this.y + Math.sin(ang+Math.PI/2)*wave*0.6);
      ctx.stroke();
      // Camada 2: azul escuro externo (outer brimstone)
      ctx.strokeStyle='#0a3a6e';
      ctx.lineWidth=this.size*2.2 + 4;
      ctx.globalAlpha=1;
      ctx.beginPath();
      ctx.moveTo(bx0 + Math.cos(ang+Math.PI/2)*wave*0.4, by0 + Math.sin(ang+Math.PI/2)*wave*0.4);
      ctx.lineTo(this.x + Math.cos(ang+Math.PI/2)*wave*0.4, this.y + Math.sin(ang+Math.PI/2)*wave*0.4);
      ctx.stroke();
      // Camada 3: azul médio vibrante (mid)
      ctx.strokeStyle='#1a7fbf';
      ctx.lineWidth=this.size*1.5 + 2.5;
      ctx.beginPath();
      ctx.moveTo(bx0 + Math.cos(ang+Math.PI/2)*wave2*0.3, by0 + Math.sin(ang+Math.PI/2)*wave2*0.3);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
      // Camada 4: ciano brilhante interno
      ctx.strokeStyle='#7af2ff';
      ctx.lineWidth=this.size*0.85 + 1.2;
      ctx.globalAlpha=0.98;
      ctx.beginPath();
      ctx.moveTo(bx0, by0);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
      ctx.globalAlpha=1;
      // Núcleo branco-azulado pulsante (coração do Brimstone)
      ctx.strokeStyle='rgba(255,255,255,0.98)';
      ctx.lineWidth=Math.max(1.2, this.size*0.45);
      ctx.beginPath();
      ctx.moveTo(bx0 + this.dirX*4, by0 + this.dirY*4);
      ctx.lineTo(this.x - this.dirX*2, this.y - this.dirY*2);
      ctx.stroke();
      // Cabeça do feixe (ponta arredondada característica Azazel)
      const headX = this.x + this.dirX*1.5;
      const headY = this.y + this.dirY*1.5;
      // Glow cabeça
      ctx.fillStyle='rgba(122,242,255,0.32)';
      ctx.beginPath(); ctx.arc(headX, headY, this.size*1.25, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='#0a3a6e';
      ctx.beginPath(); ctx.arc(headX, headY, this.size*0.85, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='#1a7fbf';
      ctx.beginPath(); ctx.arc(headX, headY, this.size*0.62, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='#b8fffb';
      ctx.beginPath(); ctx.arc(headX, headY, this.size*0.38, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='#ffffff';
      ctx.beginPath(); ctx.arc(headX, headY, this.size*0.18, 0, Math.PI*2); ctx.fill();
      // Partículas de sangue azul (lágrima demoníaca) ao longo do feixe
      if(Math.random()<0.55){
        const pr = Math.random();
        const px = bx0 + (this.x-bx0)*pr + (Math.random()-0.5)*3;
        const py = by0 + (this.y-by0)*pr + (Math.random()-0.5)*3;
        ctx.fillStyle = Math.random()<0.5 ? 'rgba(122,242,255,0.85)' : 'rgba(255,255,255,0.75)';
        ctx.fillRect(px, py, Math.random()<0.5?1.5:1, Math.random()<0.5?1.5:1);
      }
      // Brilho extra na origem (olho/chifre Azazel)
      ctx.fillStyle='rgba(122,242,255,0.18)';
      ctx.beginPath(); ctx.arc(bx0, by0, 5 + Math.sin(t)*1.2, 0, Math.PI*2); ctx.fill();
      return;
    }
    // Corte de Vento da ESPADA - visual de slash crescent perfurante
    if(this.isSwordWave){
      const ang=Math.atan2(this.dirY,this.dirX);
      const len=22, thick=9;
      const px=-Math.sin(ang), py=Math.cos(ang);
      // rastro de vento (glow)
      ctx.strokeStyle=this.glow;
      ctx.lineWidth=thick+7;
      ctx.lineCap='round';
      ctx.globalAlpha=0.55;
      ctx.beginPath();
      ctx.moveTo(this.x - this.dirX*16 + px*5, this.y - this.dirY*16 + py*5);
      ctx.lineTo(this.x + px*2, this.y + py*2);
      ctx.stroke();
      ctx.globalAlpha=1;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(ang);
      // glow externo elíptico
      ctx.fillStyle=this.glow;
      ctx.beginPath(); ctx.ellipse(0,0, len+2, thick+3, 0, -0.95, 0.95); ctx.fill();
      // corpo do corte (prateado-azulado)
      ctx.fillStyle=this.color;
      ctx.beginPath(); ctx.ellipse(0,0, len, thick, 0, -0.92, 0.92); ctx.fill();
      // brilho interno branco
      ctx.fillStyle='rgba(255,255,255,0.92)';
      ctx.beginPath(); ctx.ellipse(2,0, len*0.58, thick*0.38, 0, -0.78, 0.78); ctx.fill();
      // borda highlight
      ctx.strokeStyle='rgba(255,255,255,0.88)';
      ctx.lineWidth=1.3;
      ctx.beginPath(); ctx.ellipse(0,0, len, thick, 0, -0.92, 0.92); ctx.stroke();
      // núcleo cortante
      ctx.fillStyle='#ffffff';
      ctx.beginPath(); ctx.ellipse(-1,0, len*0.22, 1.1, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      // faísca na ponta
      ctx.fillStyle='rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(this.x + Math.cos(ang)*12, this.y + Math.sin(ang)*12, 1.6, 0, Math.PI*2); ctx.fill();
      return;
    }
    // Flecha Arco - visual de flecha com haste
    if(this.isArrow){
      const len=14;
      const backX=this.x - this.dirX*len, backY=this.y - this.dirY*len;
      // haste
      ctx.strokeStyle=this.glow;
      ctx.lineWidth=3;
      ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(backX, backY); ctx.lineTo(this.x, this.y); ctx.stroke();
      // ponta
      ctx.fillStyle=this.color;
      ctx.beginPath();
      const ang=Math.atan2(this.dirY,this.dirX);
      ctx.moveTo(this.x + Math.cos(ang)*4, this.y + Math.sin(ang)*4);
      ctx.lineTo(this.x + Math.cos(ang+2.6)*7, this.y + Math.sin(ang+2.6)*7);
      ctx.lineTo(this.x + Math.cos(ang-2.6)*7, this.y + Math.sin(ang-2.6)*7);
      ctx.closePath(); ctx.fill();
      // pena
      ctx.fillStyle='#ffffff';
      ctx.fillRect(backX -2, backY -2, 4, 1.5);
      ctx.fillRect(backX -1, backY +1, 3, 1);
      return;
    }
    // Bazuca: foguete com chama
    if(this.isBazuca){
      // chama traseira
      ctx.fillStyle='rgba(255,120,40,0.85)';
      ctx.beginPath(); ctx.arc(this.x - this.dirX*8, this.y - this.dirY*8, 5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,200,60,0.95)';
      ctx.beginPath(); ctx.arc(this.x - this.dirX*6, this.y - this.dirY*6, 3,0,Math.PI*2); ctx.fill();
      // corpo foguete
      ctx.fillStyle=this.glow;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.size+5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=this.color;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.size,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#ffcc00';
      ctx.beginPath(); ctx.arc(this.x + this.dirX*3, this.y + this.dirY*3, 2,0,Math.PI*2); ctx.fill();
      return;
    }
    // rastro especial para RAIO perfurante
    if(this.pierce && this.owner==='player'){
      ctx.strokeStyle = this.glow;
      ctx.lineWidth = this.size + 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.x - this.dirX * 14, this.y - this.dirY * 14);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
      // faíscas
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(this.x, this.y, this.size*0.8, 0, Math.PI*2); ctx.fill();
    }
    ctx.fillStyle = this.glow;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI*2); ctx.fill();
    if (this.owner==='player') {
      if(this.pierce){
        ctx.fillStyle = '#e0ffff';
        ctx.beginPath(); ctx.arc(this.x, this.y, 1.5, 0, Math.PI*2); ctx.fill();
      } else {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(this.x - 1.5, this.y - 1.5, 1.8, 0, Math.PI*2); ctx.fill();
      }
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.arc(this.x, this.y, this.size*0.45, 0, Math.PI*2); ctx.fill();
    }
  }
  getRect() {
    if(this.isSwordWave){
      // hitbox alongada para corte (captura forma de crescente)
      return { x: this.x - this.size - 10, y: this.y - this.size - 6, w: (this.size+10)*2, h: (this.size+6)*2 };
    }
    return { x: this.x - this.size, y: this.y - this.size, w: this.size*2, h: this.size*2 };
  }
}

// ===================== LAZER CODIFICADO - FEIXE BRIMSTONE (retângulo reto com ondulações) =====================
// Classe para o ataque do Lazer Codificado estilo The Binding of Isaac Brimstone.
// - Retângulo reto, largura fixa, bordas com ondulação leve (seno)
// - Dano moderado, perfurante, alcance longo, instantâneo/hitscan
// - Dura LAZER_BEAM_DURATION ms na tela
class LazerBeam {
  constructor(x, y, dirX, dirY, opts={}){
    this.x = x; this.y = y; // origem (posição do jogador no disparo)
    this.dirX = dirX; this.dirY = dirY;
    this.range = opts.range ?? WEAPON_RAIO_MATEMATICO.range;
    this.damage = opts.damage ?? WEAPON_RAIO_MATEMATICO.damage;
    this.width = opts.width ?? (opts.size ?? LAZER_BEAM_WIDTH);
    // upgrades aumentam largura via bulletSize
    if(opts.size && !opts.width) this.width = opts.size * 2.1; // converte bulletSize para beam width
    this.color = opts.color ?? WEAPON_RAIO_MATEMATICO.color;
    this.glow = opts.glow ?? WEAPON_RAIO_MATEMATICO.glow;
    this.owner = opts.owner ?? 'player';
    this.life = opts.duration ?? LAZER_BEAM_DURATION;
    this.maxLife = this.life;
    this.hitEnemies = new Set();
    this.dead = false;
    this.waveAmp = opts.waveAmp ?? LAZER_BEAM_WAVE_AMP;
    this.waveFreq = opts.waveFreq ?? LAZER_BEAM_WAVE_FREQ;
    this.spawnTime = Date.now();
    // calcula comprimento efetivo até primeira parede (evita atravessar parede visualmente, mas mantém pierce opcional)
    this.effectiveRange = this.computeEffectiveRange(opts.walls);
    // se não passou walls no opts, assume range total e Game recalculará depois se necessário
    if(this.effectiveRange === undefined || this.effectiveRange === null) this.effectiveRange = this.range;
  }
  computeEffectiveRange(walls){
    if(!walls || walls.length===0) return this.range;
    // raycast simples: avança em passos de 6px e testa ponto contra walls (com margem width/2)
    const steps = Math.ceil(this.range / 6);
    for(let i=1;i<=steps;i++){
      const t = (i/steps)*this.range;
      const px = this.x + this.dirX * t;
      const py = this.y + this.dirY * t;
      // testa se centro da linha colide com parede (espessura do feixe conta)
      const half = this.width/2 + 2;
      for(const w of walls){
        if(rectCollide(px - half, py - half, half*2, half*2, w.x, w.y, w.w, w.h)){
          return Math.max(12, t - 6); // corta um pouco antes da parede para não entrar
        }
      }
    }
    return this.range;
  }
  update(dt, walls, player){
    this.life -= dt;
    if(this.life <= 0) this.dead = true;
    // opcional: segue jogador levemente (Brimstone gira com jogador) - manter origem fixa para não confundir, mas atualiza levemente
    // Se quiser follow, descomente: this.x = player ? player.x : this.x; this.y = player ? player.y : this.y;
  }
  // Testa se inimigo colide com o retângulo grosso do feixe (com tolerância)
  hits(enemy){
    if(this.hitEnemies.has(enemy)) return false;
    if(enemy.dead) return false;
    // Projeção do centro do inimigo sobre a linha do feixe
    const ex = enemy.x, ey = enemy.y;
    const ox = this.x, oy = this.y;
    const dx = this.dirX, dy = this.dirY;
    const len = this.effectiveRange;
    // vetor origem -> inimigo
    const vx = ex - ox, vy = ey - oy;
    const proj = vx*dx + vy*dy; // distância ao longo do feixe
    if(proj < -8 || proj > len + enemy.w*0.5) return false; // atrás ou além do fim
    // distância perpendicular à linha
    const perpDist = Math.abs(vx*(-dy) + vy*dx); // |cross| já normalizado pois dx,dy é unit
    const halfW = this.width/2 + Math.max(enemy.w, enemy.h)*0.28 + this.waveAmp*0.6; // tolerância ondulação
    if(perpDist > halfW) return false;
    // Checa se linha até inimigo atravessa parede antes (feixe já cortado, então não precisa)
    return true;
  }
  registerHit(enemy){
    this.hitEnemies.add(enemy);
  }
  draw(ctx){
    const ox = this.x, oy = this.y;
    const dx = this.dirX, dy = this.dirY;
    const len = this.effectiveRange;
    const ex = ox + dx * len;
    const ey = oy + dy * len;
    const px = -dy, py = dx; // perpendicular unit
    const half = this.width/2;
    const time = Date.now() * LAZER_BEAM_WAVE_SPEED;
    const segs = Math.max(14, Math.floor(len/18)); //细分 para ondulação
    // Gera pontos da borda superior e inferior com ondulação senoidal
    const topPoints = [];
    const botPoints = [];
    for(let i=0;i<=segs;i++){
      const t = i/segs;
      const bx = ox + dx * len * t;
      const by = oy + dy * len * t;
      // ondulação: seno ao longo do feixe, fase baseada no tempo
      const wave = Math.sin(t * Math.PI * 2 * this.waveFreq * segs * 0.18 + time*2.4) * this.waveAmp;
      const wave2 = Math.cos(t * Math.PI * 2 * this.waveFreq * segs * 0.14 + time*1.7) * this.waveAmp * 0.6;
      const off = wave + wave2*0.5;
      // atenua ondulação nas extremidades (origem e ponta)
      const edgeFade = Math.sin(t*Math.PI); // 0 nas pontas, 1 no meio
      const finalOff = off * (0.35 + edgeFade*0.65);
      topPoints.push({x: bx + px * (half + finalOff), y: by + py * (half + finalOff)});
      botPoints.push({x: bx + px * (-half - finalOff), y: by + py * (-half - finalOff)});
    }
    const alphaLife = clamp(this.life/this.maxLife, 0, 1);
    const fadeAlpha = alphaLife > 0.65 ? 1 : alphaLife/0.65; // fade out no final

    // Sombra externa espessa escura (contorno)
    ctx.save();
    ctx.globalAlpha = 0.92 * fadeAlpha;
    ctx.fillStyle = 'rgba(2,12,28,0.96)';
    ctx.beginPath();
    ctx.moveTo(topPoints[0].x, topPoints[0].y);
    for(let i=1;i<topPoints.length;i++) ctx.lineTo(topPoints[i].x, topPoints[i].y);
    for(let i=botPoints.length-1;i>=0;i--) ctx.lineTo(botPoints[i].x, botPoints[i].y);
    ctx.closePath();
    ctx.fill();

    // Camada 2: outer azul escuro (Brimstone)
    ctx.globalAlpha = 0.98 * fadeAlpha;
    ctx.fillStyle = '#0a3a6e';
    ctx.beginPath();
    // contrai 1.8px
    const inset1 = 1.8;
    ctx.moveTo(topPoints[0].x - px*inset1, topPoints[0].y - py*inset1);
    for(let i=1;i<topPoints.length;i++){
      const p = topPoints[i];
      ctx.lineTo(p.x - px*inset1, p.y - py*inset1);
    }
    for(let i=botPoints.length-1;i>=0;i--){
      const p = botPoints[i];
      ctx.lineTo(p.x + px*inset1, p.y + py*inset1);
    }
    ctx.closePath();
    ctx.fill();

    // Camada 3: azul médio vibrante
    ctx.fillStyle = '#1a7fbf';
    const inset2 = 4.2;
    ctx.beginPath();
    ctx.moveTo(topPoints[0].x - px*inset2, topPoints[0].y - py*inset2);
    for(let i=1;i<topPoints.length;i++){
      const p=topPoints[i];
      ctx.lineTo(p.x - px*inset2, p.y - py*inset2);
    }
    for(let i=botPoints.length-1;i>=0;i--){
      const p=botPoints[i];
      ctx.lineTo(p.x + px*inset2, p.y + py*inset2);
    }
    ctx.closePath();
    ctx.fill();

    // Camada 4: ciano interno
    ctx.fillStyle = '#7af2ff';
    const inset3 = 6.8;
    ctx.beginPath();
    ctx.moveTo(topPoints[0].x - px*inset3, topPoints[0].y - py*inset3);
    for(let i=1;i<topPoints.length;i++){
      const p=topPoints[i];
      ctx.lineTo(p.x - px*inset3, p.y - py*inset3);
    }
    for(let i=botPoints.length-1;i>=0;i--){
      const p=botPoints[i];
      ctx.lineTo(p.x + px*inset3, p.y + py*inset3);
    }
    ctx.closePath();
    ctx.fill();

    // Núcleo branco-azulado pulsante (retângulo estreito central)
    ctx.globalAlpha = 0.96 * fadeAlpha;
    ctx.fillStyle = '#ffffff';
    const insetCore = 8.8;
    ctx.beginPath();
    ctx.moveTo(topPoints[0].x - px*insetCore, topPoints[0].y - py*insetCore);
    for(let i=1;i<topPoints.length;i++){
      const p=topPoints[i];
      // só metade da largura interna para núcleo fino
      if(i%2===0) ctx.lineTo(p.x - px*insetCore, p.y - py*insetCore);
    }
    for(let i=botPoints.length-1;i>=0;i--){
      const p=botPoints[i];
      if(i%2===0) ctx.lineTo(p.x + px*(insetCore-1.5), p.y + py*(insetCore-1.5));
    }
    ctx.closePath();
    ctx.fill();

    // Cabeça arredondada na ponta (cap)
    ctx.globalAlpha = 1 * fadeAlpha;
    ctx.fillStyle = 'rgba(122,242,255,0.32)';
    ctx.beginPath(); ctx.arc(ex, ey, half*0.95, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#0a3a6e';
    ctx.beginPath(); ctx.arc(ex, ey, half*0.72, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#1a7fbf';
    ctx.beginPath(); ctx.arc(ex, ey, half*0.52, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#b8fffb';
    ctx.beginPath(); ctx.arc(ex, ey, half*0.32, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(ex, ey, half*0.16, 0, Math.PI*2); ctx.fill();

    // Origem glow (olho demoníaco)
    ctx.fillStyle = 'rgba(122,242,255,0.16)';
    ctx.beginPath(); ctx.arc(ox, oy, 7 + Math.sin(time*2)*1.1, 0, Math.PI*2); ctx.fill();
    // Faíscas aleatórias ao longo do feixe (sangue azul)
    if(Math.random()<0.72){
      for(let s=0;s<2;s++){
        const t = Math.random();
        const bx = ox + dx*len*t + px*(Math.random()-0.5)*4;
        const by = oy + dy*len*t + py*(Math.random()-0.5)*4;
        ctx.fillStyle = Math.random()<0.5 ? 'rgba(255,255,255,0.88)' : 'rgba(184,255,251,0.92)';
        ctx.fillRect(bx, by, 1.4, 1.4);
      }
    }
    ctx.restore();
  }
  getRect(){
    // bounding box aproximada para debug; colisão real é hits()
    const ex = this.x + this.dirX*this.effectiveRange;
    const ey = this.y + this.dirY*this.effectiveRange;
    const half = this.width/2 + 4;
    return {
      x: Math.min(this.x, ex) - half,
      y: Math.min(this.y, ey) - half,
      w: Math.abs(ex-this.x)+half*2,
      h: Math.abs(ey-this.y)+half*2
    };
  }
}

// ===================== MELEE SWING (Armas corpo a corpo) =====================
class MeleeSwing {
  constructor(x, y, dirX, dirY, opts={}){
    this.x=x; this.y=y;
    this.dirX=dirX; this.dirY=dirY;
    this.range=opts.range||62;
    this.angle=opts.angle||100;
    this.damage=opts.damage||1.5;
    this.life=opts.duration||140;
    this.maxLife=opts.duration||140;
    this.color=opts.color||'#fff';
    this.glow=opts.glow||'rgba(255,255,255,0.14)';
    this.isHeavy=!!opts.isHeavy;
    this.hasHit=new Set();
    this.dead=false;
    this.owner=opts.owner||'player';
    this.weaponName=opts.weaponName||'MELEE';
    this.shockRadius=opts.shockRadius||0;
    this.shockDamage=opts.shockDamage||0;
    this.pierce=opts.pierce||0;
    this.pierceCount=0;
    this.stun=opts.stun||0;
  }
  update(dt){
    this.life-=dt;
    if(this.life<=0) this.dead=true;
    return !this.dead;
  }
  hits(enemy){
    if(this.hasHit.has(enemy) && this.pierce===0) return false;
    if(this.pierce>0 && this.pierceCount>=this.pierce) return false;
    const dx=enemy.x - this.x;
    const dy=enemy.y - this.y;
    const d=Math.hypot(dx,dy);
    if(d> this.range + enemy.w*0.38) return false;
    if(d<14) return true;
    const angTo=Math.atan2(dy,dx);
    const angDir=Math.atan2(this.dirY,this.dirX);
    let diff=Math.abs(angTo - angDir);
    diff=Math.atan2(Math.sin(diff), Math.cos(diff));
    diff=Math.abs(diff)*180/Math.PI;
    if(diff> this.angle/2) return false;
    return true;
  }
  registerHit(enemy){
    this.hasHit.add(enemy);
    if(this.pierce>0) this.pierceCount++;
    if(this.pierce===0) this.hasHit.add(enemy);
  }
  draw(ctx){
    const prog=1 - (this.life/this.maxLife);
    const alpha=0.82*(1-prog*0.62);
    const baseAng=Math.atan2(this.dirY,this.dirX);
    const halfRad=(this.angle/2)*Math.PI/180;
    // glow arc
    ctx.fillStyle=this.glow.replace(/0\.\d+/, String((0.12+alpha*0.10).toFixed(2)));
    ctx.beginPath(); ctx.moveTo(this.x,this.y); ctx.arc(this.x,this.y,this.range, baseAng-halfRad, baseAng+halfRad); ctx.closePath(); ctx.fill();
    ctx.strokeStyle=this.isHeavy?'rgba(255,255,255,0.84)':'rgba(255,255,255,0.58)';
    ctx.lineWidth=this.isHeavy?2.4:1.5;
    ctx.beginPath(); ctx.arc(this.x,this.y,this.range*0.92, baseAng-halfRad, baseAng+halfRad); ctx.stroke();
    const curAng=lerp(baseAng-halfRad, baseAng+halfRad, prog);
    ctx.strokeStyle=this.color;
    ctx.lineWidth=this.isHeavy?3.2:2.2;
    ctx.beginPath(); ctx.moveTo(this.x,this.y); ctx.lineTo(this.x+Math.cos(curAng)*this.range*0.96, this.y+Math.sin(curAng)*this.range*0.96); ctx.stroke();
    if(this.isHeavy){
      ctx.fillStyle='rgba(255,255,255,0.11)';
      ctx.beginPath(); ctx.arc(this.x,this.y,this.range*1.06, baseAng-halfRad, baseAng+halfRad); ctx.lineTo(this.x,this.y); ctx.fill();
      // heavy spark at tip
      const tx=this.x+Math.cos(curAng)*this.range*0.96, ty=this.y+Math.sin(curAng)*this.range*0.96;
      ctx.fillStyle='rgba(255,255,255,0.92)'; ctx.beginPath(); ctx.arc(tx,ty,2.2,0,Math.PI*2); ctx.fill();
    }
    // center dot
    ctx.fillStyle='rgba(255,255,255,0.72)'; ctx.beginPath(); ctx.arc(this.x,this.y,1.8,0,Math.PI*2); ctx.fill();
  }
}

// Helper visual: desenha mola zigue-zague entre dois pontos (usado pela Luva)
// Desenha linha elástica com dobras perpendiculares para dar sensação de mola extensível
function drawLuvaSpring(ctx, x1, y1, x2, y2, segments=7, amplitude=4.2, color='rgba(80,40,20,0.85)', width=2){
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len, ny = dy / len;
  const px = -ny, py = nx;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  for(let i=1;i<=segments;i++){
    const t = i / segments;
    const sx = x1 + dx * t;
    const sy = y1 + dy * t;
    const isMid = i>0 && i<segments;
    const zig = isMid ? ((i % 2 === 0 ? 1 : -1) * amplitude) : 0;
    const zx = sx + px * zig;
    const zy = sy + py * zig;
    ctx.lineTo(zx, zy);
  }
  ctx.stroke();
  // contorno sombra leve para profundidade
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = width + 1.2;
  ctx.globalAlpha = 0.45;
  // desenha novamente por baixo? já desenhamos por cima, para sombra precisar desenhar antes; mantém simples sem duplo pass
  ctx.globalAlpha = 1;
}

// ===================== ROCKET FIST (Luva Foguete) + JAB MOLA =====================
// Visual novo: duas luvas vão para frente e para trás (mola elástica). Quando barra cheia, lança foguete com propulsão.
// Esta classe serve tanto para jab curto (isJab=true, range 68, speed 13.5, retorno rápido) quanto para foguete longo.
// Quando isJab=false, mantém comportamento foguete original com fogo/propulsão.
class RocketFist {
  constructor(x, y, dirX, dirY, opts={}){
    this.x=x; this.y=y;
    this.dirX=dirX; this.dirY=dirY;
    this.startX=x; this.startY=y;
    this.speed=opts.speed||9.4;
    this.maxRange=opts.range||215;
    this.damage=opts.damage||1.9;
    this.returnDamage=opts.returnDamage||1.2;
    this.size=opts.size||10;
    this.color=opts.color||'#ff3b30';
    this.glow=opts.glow||'rgba(255,60,60,0.28)';
    this.owner='player';
    this.traveled=0;
    this.returning=false;
    this.dead=false;
    this.hitEnemies=new Set();
    this.hitCount=0;
    this.pierce=opts.pierce||0;
    this.returnSpeedBonus=opts.returnSpeedBonus||0;
    this.life=opts.life||4200;
    this.trail=[];
    this.isJab = !!opts.isJab; // true = soco mola curto (visual mola, sem fogo), false = foguete longo com propulsão
    this.jabReturnFactor = opts.jabReturnFactor || LUVA_JAB_RETURN_FACTOR || 1.38;
    this.spawnTime = Date.now();
  }
  update(dt, player, walls, particles){
    const wasReturning=this.returning;
    this.life-=dt;
    if(this.life<=0){ this.dead=true; return false; }
    // trilha diferente para jab vs foguete
    if(this.isJab){
      // jab: trilha sutil elástica (menos partículas)
      if(Math.random()<0.45) this.trail.push({x:this.x,y:this.y,life:120});
      if(this.trail.length>5) this.trail.shift();
    } else {
      this.trail.push({x:this.x,y:this.y,life:220});
      if(this.trail.length>8) this.trail.shift();
    }
    for(const t of this.trail) t.life-=dt;
    this.trail=this.trail.filter(t=>t.life>0);
    if(!this.returning){
      const dx=this.dirX*this.speed;
      const dy=this.dirY*this.speed;
      this.x+=dx; this.y+=dy;
      this.traveled+=Math.hypot(dx,dy);
      for(const w of walls){
        if(circleRectCollide(this.x,this.y,this.size,w.x,w.y,w.w,w.h)){ this.returning=true; break; }
      }
      if(this.traveled>=this.maxRange) this.returning=true;
      if(dist(this.x,this.y,player.x,player.y)> this.maxRange+48) this.returning=true;
    } else {
      const toPx=player.x - this.x;
      const toPy=player.y - this.y;
      const d=Math.hypot(toPx,toPy);
      if(d<16){ this.dead=true;
        if(particles){
          if(this.isJab){
            for(let k=0;k<7;k++) particles.push(new Particle(this.x,this.y, randRange(-1.4,1.4), randRange(-1.4,0.5), 180, '#ff8c42', 1.8));
            for(let k=0;k<3;k++) particles.push(new Particle(this.x,this.y, randRange(-0.8,0.8), randRange(-0.6,0.4), 150, 'rgba(255,220,120,0.9)', 1.2));
          } else {
            for(let k=0;k<9;k++) particles.push(new Particle(this.x,this.y, randRange(-1.6,1.6), randRange(-1.6,0.6), 220, this.color, 2));
          }
        }
        return false;
      }
      const n=normalize(toPx,toPy);
      const base = this.isJab ? this.jabReturnFactor : 1.22;
      const retSpeed=this.speed*(base + (this.returnSpeedBonus||0));
      this.x+=n.x*retSpeed;
      this.y+=n.y*retSpeed;
      this.dirX=n.x; this.dirY=n.y;
    }
    if(!wasReturning && this.returning){
      this.hitEnemies.clear();
      this.hitCount=0;
      if(particles){
        if(this.isJab) for(let k=0;k<5;k++) particles.push(new Particle(this.x,this.y, randRange(-1.1,1.1), randRange(-0.7,0.4), 140, '#ffd700', 1.3));
        else for(let k=0;k<6;k++) particles.push(new Particle(this.x,this.y, randRange(-1.2,1.2), randRange(-0.8,0.4), 180, '#fff8a0', 1.4));
      }
    }
    if(this.x<-22||this.x>CANVAS_W+22||this.y<-22||this.y>CANVAS_H+22){
      if(this.returning) this.dead=true;
      else this.returning=true;
    }
    return !this.dead;
  }
  draw(ctx){
    // trilha diferenciada
    if(this.isJab){
      for(const t of this.trail){
        const a=t.life/120;
        ctx.fillStyle=`rgba(255,140,60,${a*0.14})`;
        ctx.beginPath(); ctx.arc(t.x,t.y,2.8*a,0,Math.PI*2); ctx.fill();
      }
      // brilho elástico sutil enquanto estica
      if(!this.returning){
        ctx.fillStyle='rgba(255,200,80,0.22)';
        ctx.beginPath(); ctx.arc(this.x - this.dirX*4, this.y - this.dirY*4, this.size*0.62,0,Math.PI*2); ctx.fill();
      }
    } else {
      for(const t of this.trail){
        const a=t.life/220;
        ctx.fillStyle=`rgba(255,60,60,${a*0.18})`;
        ctx.beginPath(); ctx.arc(t.x,t.y,4*a,0,Math.PI*2); ctx.fill();
      }
      const bob=Math.sin(Date.now()*0.022)*1.4;
      if(!this.returning){
        const backX=this.x - this.dirX*12, backY=this.y - this.dirY*12 + bob*0.5;
        ctx.fillStyle='rgba(255,120,40,0.92)';
        ctx.beginPath(); ctx.arc(backX,backY,5.2,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(255,200,60,0.96)';
        ctx.beginPath(); ctx.arc(backX - this.dirX*4, backY - this.dirY*4,3.2,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.94)';
        ctx.beginPath(); ctx.arc(backX - this.dirX*7, backY - this.dirY*7,1.7,0,Math.PI*2); ctx.fill();
        // faísca extra propulsão foguete
        if(Math.random()<0.45){
          ctx.fillStyle='rgba(255,160,30,0.72)';
          ctx.beginPath(); ctx.arc(backX - this.dirX*9 - randRange(-1,1), backY - this.dirY*9 - randRange(-1,1), 1.6,0,Math.PI*2); ctx.fill();
        }
      } else {
        ctx.fillStyle='rgba(255,255,255,0.72)';
        ctx.beginPath(); ctx.arc(this.x+randRange(-2,2), this.y+randRange(-2,2),1.6,0,Math.PI*2); ctx.fill();
      }
    }
    // glow luva
    const progTrail = this.isJab ? 0.22 : 0.30;
    ctx.fillStyle = this.isJab ? 'rgba(255,100,50,0.20)' : this.glow;
    ctx.beginPath(); ctx.arc(this.x,this.y,this.size+ (this.isJab?3:4),0,Math.PI*2); ctx.fill();
    // corpo luva: diferencia jab (vermelho vivo + detalhe mola) vs foguete (vermelho com faixa dourada e fogo)
    if(this.isJab){
      // luva jab - visual mola curta, mais nítida
      ctx.fillStyle = this.returning ? '#ff6b5a' : this.color;
      ctx.beginPath(); ctx.arc(this.x,this.y,this.size,0,Math.PI*2); ctx.fill();
      // contorno sombra
      ctx.strokeStyle='rgba(0,0,0,0.28)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(this.x,this.y,this.size,0,Math.PI*2); ctx.stroke();
      // faixa central elástica (mola)
      ctx.fillStyle='#1a1a1a';
      ctx.fillRect(this.x - this.size*0.58, this.y -1.8, this.size*1.16, 3.4);
      // detalhe dourado pequeno
      ctx.fillStyle='#ffd700';
      ctx.fillRect(this.x -1.8, this.y -3.8, 3.6, 1.6);
      // brilho topo
      ctx.fillStyle='rgba(255,255,255,0.88)';
      ctx.beginPath(); ctx.arc(this.x-1.9,this.y-1.9,1.5,0,Math.PI*2); ctx.fill();
      // indicador direção (pequena seta)
      ctx.fillStyle='rgba(255,255,255,0.62)';
      ctx.beginPath(); ctx.arc(this.x + this.dirX*3, this.y + this.dirY*3, 1.1,0,Math.PI*2); ctx.fill();
    } else {
      // foguete - mais parrudo com faixas e brilho
      ctx.fillStyle=this.color;
      ctx.beginPath(); ctx.arc(this.x,this.y,this.size,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#1a1a1a';
      ctx.fillRect(this.x - this.size*0.62, this.y -2.4, this.size*1.20, 4.4);
      ctx.fillStyle='#ffcc00';
      ctx.fillRect(this.x -2.4, this.y -4.6, 4.8, 2.4);
      // faixa extra foguete
      ctx.fillStyle='#ff8c42';
      ctx.fillRect(this.x - this.size*0.45, this.y + 1.2, this.size*0.9, 1.2);
      ctx.strokeStyle='rgba(0,0,0,0.32)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(this.x,this.y,this.size*0.68,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,0.90)';
      ctx.beginPath(); ctx.arc(this.x-2.1,this.y-2.1,1.9,0,Math.PI*2); ctx.fill();
      // estrias de velocidade
      ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.lineWidth=0.9;
      ctx.beginPath(); ctx.moveTo(this.x - this.dirX*8, this.y - this.dirY*8); ctx.lineTo(this.x - this.dirX*13, this.y - this.dirY*13); ctx.stroke();
    }
  }
  getRect(){ return {x:this.x-this.size,y:this.y-this.size,w:this.size*2,h:this.size*2}; }
}

// ===================== BASTÃO PROJECTILE (JG EXCLUSIVO) =====================
// Bastão arremessável que gira durante o voo, causa dano e retorna automaticamente
// Sem duplicação: apenas um bastão pode existir por vez (gerenciado por Player.hasBastao)
class BastaoProjectile {
  constructor(x, y, dirX, dirY, opts={}){
    this.x=x; this.y=y;
    this.dirX=dirX; this.dirY=dirY;
    this.speed=opts.speed||JG_BASTAO_RETURN_SPEED||9.2;
    this.maxRange=opts.range||JG_BASTAO_SIZE?340:340;
    // corrige range se opts não passado
    if(opts.range) this.maxRange=opts.range;
    else this.maxRange=WEAPON_BASTAO.throwRange||340;
    this.damage=opts.damage||JG_BASTAO_DAMAGE||2.8;
    this.size=opts.size||JG_BASTAO_SIZE||9;
    this.color=opts.color||'#facc15';
    this.glow=opts.glow||'rgba(250,204,21,0.28)';
    this.owner='player';
    this.traveled=0;
    this.returning=false;
    this.dead=false;
    this.hitEnemies=new Set();
    this.spin=0;
    this.trail=[];
    this.life=5000; // tempo máximo antes de forçar retorno
  }
  update(dt, player, walls, particles){
    const wasReturning=this.returning;
    this.life-=dt;
    if(this.life<=0) this.returning=true;
    this.spin += dt*0.018; // gira rápido
    this.trail.push({x:this.x,y:this.y,life:180, alpha:1});
    if(this.trail.length>10) this.trail.shift();
    for(const t of this.trail) t.life-=dt;
    this.trail=this.trail.filter(t=>t.life>0);
    if(!this.returning){
      const dx=this.dirX*this.speed;
      const dy=this.dirY*this.speed;
      this.x+=dx; this.y+=dy;
      this.traveled+=Math.hypot(dx,dy);
      // colisão parede => começa retorno
      for(const w of walls){
        if(circleRectCollide(this.x,this.y,this.size+3,w.x,w.y,w.w,w.h)){ this.returning=true; break; }
      }
      if(this.traveled>=this.maxRange) this.returning=true;
      // também força retorno se muito longe do player (evita perder bastão)
      if(dist(this.x,this.y,player.x,player.y) > this.maxRange+60) this.returning=true;
      if(this.x<-24||this.x>CANVAS_W+24||this.y<-24||this.y>CANVAS_H+24) this.returning=true;
      // partículas de rastro giratório
      if(particles && Math.random()<0.35){
        particles.push(new Particle(this.x+randRange(-4,4),this.y+randRange(-4,4), randRange(-0.6,0.6), randRange(-0.6,0.6), 180, 'rgba(250,204,21,0.85)', 1.8));
      }
    } else {
      // retorna para o jogador
      const toPx=player.x - this.x;
      const toPy=player.y - this.y;
      const d=Math.hypot(toPx,toPy);
      if(d<16){
        this.dead=true;
        if(particles){
          for(let k=0;k<12;k++) particles.push(new Particle(this.x,this.y, randRange(-1.8,1.8), randRange(-1.8,0.6), 240, '#facc15', 2));
          for(let k=0;k<6;k++) particles.push(new Particle(this.x,this.y, randRange(-1,1), -1.0, 200, '#ffffff', 1.6));
        }
        return false;
      }
      const n=normalize(toPx,toPy);
      const retSpeed=this.speed*1.18;
      this.x+=n.x*retSpeed;
      this.y+=n.y*retSpeed;
      this.dirX=n.x; this.dirY=n.y;
      // partículas retorno
      if(particles && Math.random()<0.25){
        particles.push(new Particle(this.x,this.y, -n.x*randRange(0.6,1.2), -n.y*randRange(0.6,1.2), 160, '#facc15', 1.4));
      }
    }
    // ao começar a retornar, limpa hitEnemies para dano na volta (indo e voltando)
    if(!wasReturning && this.returning){
      this.hitEnemies.clear();
      if(particles) for(let k=0;k<6;k++) particles.push(new Particle(this.x,this.y, randRange(-1.2,1.2), randRange(-0.8,0.4), 180, '#fff8a0', 1.4));
    }
    return !this.dead;
  }
  draw(ctx){
    // rastro
    for(const t of this.trail){
      const a=clamp(t.life/180,0,1);
      ctx.fillStyle=`rgba(250,204,21,${a*0.22})`;
      ctx.beginPath(); ctx.arc(t.x,t.y, (this.size+6)*a,0,Math.PI*2); ctx.fill();
    }
    ctx.save();
    ctx.translate(this.x,this.y);
    ctx.rotate(this.spin);
    // glow externo rotativo
    ctx.fillStyle=this.glow;
    ctx.fillRect(-14,-3,28,6);
    ctx.fillStyle='rgba(250,204,21,0.14)';
    ctx.beginPath(); ctx.arc(0,0, this.size+10,0,Math.PI*2); ctx.fill();
    // corpo bastão (retângulo arredondado girando)
    ctx.fillStyle='#3a2e00';
    ctx.fillRect(-12,-4,24,8);
    ctx.fillStyle=this.color;
    ctx.fillRect(-11,-3,22,6);
    ctx.fillStyle='#fffbeb';
    ctx.fillRect(-10,-1,20,2);
    // detalhes extremidades
    ctx.fillStyle='#1a1500';
    ctx.fillRect(-12,-4,3,8);
    ctx.fillRect(9,-4,3,8);
    // brilho central quando girando rápido
    if(Math.floor(this.spin*2)%2===0){
      ctx.fillStyle='rgba(255,255,255,0.88)';
      ctx.fillRect(-2,-3,4,6);
    }
    ctx.restore();
    // núcleo central brilhante
    ctx.fillStyle='rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(this.x,this.y,2.2,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(250,204,21,0.55)';
    ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.arc(this.x,this.y,this.size+2,0,Math.PI*2); ctx.stroke();
  }
  getRect(){ return {x:this.x-this.size,y:this.y-this.size,w:this.size*2,h:this.size*2}; }
}

// ===================== OLI - PEÇAS DE XADREZ =====================
// Cada peça tem vida/dano/comportamento próprios e reconhece Oli como dono

class TorrePiece {
  constructor(x, y, owner){
    this.x=x; this.y=y; this.owner=owner; this.w=26; this.h=26;
    this.hp=OLI_TORRE_HP; this.maxHp=OLI_TORRE_HP; this.damage=OLI_TORRE_DAMAGE;
    this.speed=OLI_TORRE_SPEED; this.chargeSpeed=OLI_TORRE_CHARGE_SPEED;
    this.life=OLI_TORRE_LIFE; this.maxLife=OLI_TORRE_LIFE;
    this.dead=false; this.anim=Math.random()*1000; this.hitFlash=0;
    this.type='torre'; this.isChessPiece=true; this.ownerId=owner?owner.characterId:null;
    this.dirY = Math.random()<0.5?1:-1; this.charging=false; this.chargeTargetY=0; this.chargeTargetX=0; this.chargeAxis=null; this.chargeCooldown=0;
  }
  takeDamage(dmg){ this.hp-=dmg; this.hitFlash=140; if(this.hp<=0){this.dead=true; return true;} return false; }
  update(dt, enemies, walls, particles){
    this.life-=dt; this.anim+=dt; if(this.hitFlash>0) this.hitFlash-=dt; if(this.chargeCooldown>0) this.chargeCooldown-=dt;
    if(this.life<=0){this.dead=true; return false;}
    if(this.dead) return false;
    // Detecta inimigo na mesma coluna OU mesma linha (vertical e horizontal)
    let target=null, bestDist=999, targetAxis=null;
    for(const e of enemies){
      if(e.dead) continue;
      // vertical - mesma coluna
      if(Math.abs(e.x - this.x) < OLI_TORRE_DETECT_X){
        const dy = Math.abs(e.y - this.y);
        if(dy < 320 && dy < bestDist){
          let blocked=false;
          const steps=8;
          for(let i=1;i<steps;i++){
            const ty = lerp(this.y, e.y, i/steps);
            for(const w of walls) if(rectCollide(this.x-4, ty-4, 8,8,w.x,w.y,w.w,w.h)){blocked=true;break;}
            if(blocked) break;
          }
          if(!blocked){ target=e; bestDist=dy; targetAxis='y'; }
        }
      }
      // horizontal - mesma linha
      if(Math.abs(e.y - this.y) < OLI_TORRE_DETECT_X){
        const dx = Math.abs(e.x - this.x);
        if(dx < 320 && dx < bestDist){
          let blocked=false;
          const steps=8;
          for(let i=1;i<steps;i++){
            const tx = lerp(this.x, e.x, i/steps);
            for(const w of walls) if(rectCollide(tx-4, this.y-4, 8,8,w.x,w.y,w.w,w.h)){blocked=true;break;}
            if(blocked) break;
          }
          if(!blocked){ target=e; bestDist=dx; targetAxis='x'; }
        }
      }
    }
    if(target && this.chargeCooldown<=0 && !this.charging){
      this.charging=true;
      this.chargeAxis=targetAxis;
      if(targetAxis==='y') this.chargeTargetY=target.y;
      else this.chargeTargetX=target.x;
      this.chargeCooldown=1400;
    }
    let curSpeed = this.charging? this.chargeSpeed : this.speed;
    if(this.charging){
      if(this.chargeAxis==='x'){
        let dx = Math.sign(this.chargeTargetX - this.x);
        let nx = this.x + dx * curSpeed;
        let canX=true;
        for(const w of walls) if(rectCollide(nx-this.w/2, this.y-this.h/2, this.w, this.h, w.x,w.y,w.w,w.h)){canX=false;break;}
        if(!canX){
          this.charging=false;
        } else {
          this.x=nx;
        }
        if(Math.abs(this.x - this.chargeTargetX) < 8){
          this.charging=false;
          if(particles) for(let k=0;k<6;k++) particles.push(new Particle(this.x,this.y, randRange(-1.5,1.5), randRange(-1.2,0.6), 200, '#60a5fa',1.8));
        }
        this.x=clamp(this.x, WALL_THICK+this.w/2, CANVAS_W-WALL_THICK-this.w/2);
      } else {
        let dy = Math.sign(this.chargeTargetY - this.y);
        let ny = this.y + dy * curSpeed;
        let canY=true;
        for(const w of walls) if(rectCollide(this.x-this.w/2, ny-this.h/2, this.w, this.h, w.x,w.y,w.w,w.h)){canY=false;break;}
        if(!canY){
          this.charging=false;
        } else {
          this.y=ny;
        }
        if(Math.abs(this.y - this.chargeTargetY) < 8){
          this.charging=false;
          if(particles) for(let k=0;k<6;k++) particles.push(new Particle(this.x,this.y, randRange(-1.5,1.5), randRange(-1.2,0.6), 200, '#60a5fa',1.8));
        }
        this.y=clamp(this.y, WALL_THICK+this.h/2, CANVAS_H-WALL_THICK-this.h/2);
      }
    } else {
      let ny = this.y + this.dirY * curSpeed;
      let canY=true;
      for(const w of walls) if(rectCollide(this.x-this.w/2, ny-this.h/2, this.w, this.h, w.x,w.y,w.w,w.h)){canY=false;break;}
      if(!canY){
        this.dirY *= -1;
      } else {
        this.y=ny;
      }
      this.y=clamp(this.y, WALL_THICK+this.h/2, CANVAS_H-WALL_THICK-this.h/2);
    }
    this.x=clamp(this.x, WALL_THICK+this.w/2, CANVAS_W-WALL_THICK-this.w/2);
    // colisão com inimigos - causa dano ao tocar
    for(const e of enemies){
      if(e.dead) continue;
      if(rectCollide(this.x-this.w/2, this.y-this.h/2, this.w, this.h, e.x-e.w/2, e.y-e.h/2, e.w, e.h)){
        // não ataca dono (Oli já é dono, mas inimigos não são dono)
        const died=e.takeDamage(this.damage*0.35); // dano por contato é menor que investida?
        // Torre causa dano maior quando carregando
        const actualDmg = this.charging ? this.damage : this.damage*0.6;
        if(!died) {
          // se não morreu, aplica dano real (já aplicado acima com 0.35, corrige)
          // já causamos 0.35, vamos causar restante
          e.takeDamage(actualDmg - this.damage*0.35);
        }
        e.hitFlash=120;
        const ang=Math.atan2(e.y-this.y, e.x-this.x);
        e.x+=Math.cos(ang)*6; e.y+=Math.sin(ang)*6;
        if(particles) for(let k=0;k<3;k++) particles.push(new Particle(e.x,e.y, randRange(-1,1), randRange(-1,0.5), 180, '#60a5fa',1.6));
        // Torre perde um pouco de vida ao colidir? Não, apenas quando inimigo encosta nela ela já causa dano, mas se quiser dar vida, não perde
      }
    }
    return !this.dead;
  }
  draw(ctx){
    const x=this.x-this.w/2, y=this.y-this.h/2, bob=Math.sin(this.anim*0.008)*1.2;
    const isFlash=this.hitFlash>0 && Math.floor(this.hitFlash/40)%2===0;
    // aura torre premium - cruz azul com brilho
    const pulse=0.5+Math.sin(this.anim*0.011)*0.30;
    ctx.fillStyle=isFlash?'rgba(255,255,255,0.20)':`rgba(96,165,250,${0.12+pulse*0.08})`;
    ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.92+pulse*3.2,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=isFlash?'rgba(255,255,255,0.32)':`rgba(96,165,250,${0.18+pulse*0.10})`; ctx.lineWidth=1.1; ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.78,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle='rgba(0,0,0,0.30)'; ctx.fillRect(x+2, y+this.h-3, this.w,3);
    // corpo torre com gradiente e textura pedra
    ctx.fillStyle=isFlash?'#fff':'#2f5fd0'; ctx.fillRect(x+3, y+4+bob, this.w-6, this.h-8);
    // highlight esquerda e sombra direita para 3D
    ctx.fillStyle=isFlash?'#dbeafe':'#5b8def'; ctx.fillRect(x+3, y+4+bob, 2, this.h-8);
    ctx.fillStyle=isFlash?'#93b4ff':'#1e3a8a'; ctx.fillRect(x+this.w-5, y+4+bob, 2, this.h-8);
    // colunas laterais metálicas
    ctx.fillStyle=isFlash?'#e0ecff':'#1e3a5f'; ctx.fillRect(x, y+6+bob, 3.2, this.h-10); ctx.fillRect(x+this.w-3.2, y+6+bob, 3.2, this.h-10);
    ctx.fillStyle='rgba(255,255,255,0.55)'; ctx.fillRect(x+0.6, y+6+bob, 1, this.h-10);
    // fissuras pedra
    ctx.fillStyle='rgba(0,0,0,0.22)'; ctx.fillRect(x+9, y+8+bob, 8,0.8); ctx.fillRect(x+7, y+12+bob, 6,0.7);
    // topo torre ameias com bisel 3D
    ctx.fillStyle=isFlash?'#fff':'#8fb4ff'; ctx.fillRect(x+1.5, y+1.5+bob, 5,4.5); ctx.fillRect(x+10, y+1.5+bob, 4.5,4.5); ctx.fillRect(x+18.5, y+1.5+bob, 5,4.5);
    ctx.fillStyle=isFlash?'#dbeafe':'#3b82f6'; ctx.fillRect(x+1.5, y+2+bob, 5,3); ctx.fillRect(x+10, y+2+bob, 4.5,3); ctx.fillRect(x+18.5, y+2+bob, 5,3);
    ctx.fillStyle='#1e40af'; ctx.fillRect(x+6.5, y+3.2+bob, 3,2); ctx.fillRect(x+14.5, y+3.2+bob, 3,2);
    // brilho superior
    ctx.fillStyle='rgba(255,255,255,0.42)'; ctx.fillRect(x+3, y+2+bob, this.w-6,1);
    // símbolo ♜ com sombra e brilho
    ctx.shadowColor='rgba(0,0,0,0.45)'; ctx.shadowBlur=4;
    ctx.fillStyle=isFlash?'#1e3a5f':'#fff'; ctx.font='bold 13px sans-serif'; ctx.textAlign='center'; ctx.fillText('♜', this.x, y+15+bob); ctx.textAlign='left';
    ctx.shadowBlur=0;
    // detalhe cruz sutil quando não carregando
    if(!this.charging){
      ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=0.8; ctx.setLineDash([2,3]);
      ctx.beginPath(); ctx.moveTo(this.x, y+2+bob); ctx.lineTo(this.x, y+this.h+2+bob); ctx.moveTo(x+2, this.y+bob); ctx.lineTo(x+this.w-2, this.y+bob); ctx.stroke(); ctx.setLineDash([]);
    }
    // barra vida estilizada
    if(this.hp < this.maxHp){
      const pct=clamp(this.hp/this.maxHp,0,1);
      ctx.fillStyle='rgba(0,0,0,0.68)'; ctx.fillRect(x, y-8+bob, this.w,4.5);
      ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.fillRect(x+1, y-7+bob, this.w-2,2.5);
      ctx.fillStyle=pct>0.5?'#60a5fa':pct>0.3?'#facc15':'#ef4444'; ctx.fillRect(x+1, y-7+bob, (this.w-2)*pct,2.5);
      ctx.strokeStyle='rgba(255,255,255,0.10)'; ctx.lineWidth=0.8; ctx.strokeRect(x, y-8+bob, this.w,4.5);
    }
    // linha de detecção quando carregando (cruz energizada)
    if(this.charging){
      const chargePulse=0.5+Math.sin(this.anim*0.025)*0.35;
      ctx.strokeStyle=`rgba(96,165,250,${0.45+chargePulse*0.22})`; ctx.lineWidth=1.6; ctx.setLineDash([5,3]);
      ctx.beginPath();
      if(this.chargeAxis==='x'){
        ctx.moveTo(this.x, this.y+bob); ctx.lineTo(this.chargeTargetX, this.y+bob);
      } else {
        ctx.moveTo(this.x, this.y+bob); ctx.lineTo(this.x, this.chargeTargetY);
      }
      ctx.stroke(); ctx.setLineDash([]);
      // partículas energia na ponta
      const tx=this.chargeAxis==='x'?this.chargeTargetX:this.x, ty=this.chargeAxis==='x'?this.y+bob:this.chargeTargetY;
      ctx.fillStyle=`rgba(96,165,250,${0.85})`; ctx.beginPath(); ctx.arc(tx,ty,2.2+chargePulse*1.2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.92)'; ctx.beginPath(); ctx.arc(tx,ty,1,0,Math.PI*2); ctx.fill();
    }
  }
  getRect(){ return {x:this.x-this.w/2, y:this.y-this.h/2, w:this.w, h:this.h}; }
}

class BispoPiece {
  constructor(x, y, owner){
    this.x=x; this.y=y; this.owner=owner; this.w=24; this.h=24;
    this.hp=OLI_BISPO_HP; this.maxHp=OLI_BISPO_HP; this.damage=OLI_BISPO_DAMAGE;
    this.speed=OLI_BISPO_SPEED; this.life=OLI_BISPO_LIFE; this.maxLife=OLI_BISPO_LIFE;
    this.dead=false; this.anim=Math.random()*1000; this.hitFlash=0;
    this.type='bispo'; this.isChessPiece=true; this.ownerId=owner?owner.characterId:null;
    const dir=Math.random()*Math.PI*2;
    const ang = Math.floor(dir/(Math.PI/2))*Math.PI/2 + Math.PI/4; // força diagonal (45°,135°,225°,315°)
    this.vx=Math.cos(ang)*this.speed; this.vy=Math.sin(ang)*this.speed;
  }
  takeDamage(dmg){ this.hp-=dmg; this.hitFlash=140; if(this.hp<=0){this.dead=true; return true;} return false; }
  update(dt, enemies, walls, particles){
    this.life-=dt; this.anim+=dt; if(this.hitFlash>0) this.hitFlash-=dt;
    if(this.life<=0){this.dead=true; return false;}
    if(this.dead) return false;
    let nx=this.x + this.vx;
    let ny=this.y + this.vy;
    let bounceX=false, bounceY=false;
    for(const w of walls){
      if(rectCollide(nx-this.w/2, this.y-this.h/2, this.w, this.h, w.x,w.y,w.w,w.h)) bounceX=true;
      if(rectCollide(this.x-this.w/2, ny-this.h/2, this.w, this.h, w.x,w.y,w.w,w.h)) bounceY=true;
    }
    if(nx < WALL_THICK+this.w/2 || nx > CANVAS_W-WALL_THICK-this.w/2) bounceX=true;
    if(ny < WALL_THICK+this.h/2 || ny > CANVAS_H-WALL_THICK-this.h/2) bounceY=true;
    if(bounceX) this.vx*=-1;
    if(bounceY) this.vy*=-1;
    // se bateu em canto, garante que continua diagonal
    if(bounceX || bounceY){
      // normaliza para manter velocidade diagonal
      const len=Math.hypot(this.vx, this.vy)||1;
      this.vx = Math.sign(this.vx)*this.speed*0.707*1.4;
      this.vy = Math.sign(this.vy)*this.speed*0.707*1.4;
      // corrige para não ficar preso
      nx=this.x + this.vx;
      ny=this.y + this.vy;
    }
    this.x=nx; this.y=ny;
    this.x=clamp(this.x, WALL_THICK+this.w/2, CANVAS_W-WALL_THICK-this.w/2);
    this.y=clamp(this.y, WALL_THICK+this.h/2, CANVAS_H-WALL_THICK-this.h/2);
    // colisão com inimigos
    for(const e of enemies){
      if(e.dead) continue;
      if(rectCollide(this.x-this.w/2, this.y-this.h/2, this.w, this.h, e.x-e.w/2, e.y-e.h/2, e.w, e.h)){
        const died=e.takeDamage(this.damage);
        e.hitFlash=120;
        // ricocheteia ao tocar inimigo também (inverte)
        this.vx*=-1; this.vy*=-1;
        if(particles) for(let k=0;k<4;k++) particles.push(new Particle(e.x,e.y, randRange(-1.2,1.2), randRange(-1,0.4), 200, '#a78bfa',1.8));
        if(died && particles) for(let k=0;k<8;k++){const ang=Math.random()*Math.PI*2; particles.push(new Particle(e.x,e.y, Math.cos(ang)*randRange(1.2,3), Math.sin(ang)*randRange(1.2,3), 260, '#a78bfa',2));}
        break;
      }
    }
    // trilha diagonal
    if(particles && Math.random()<0.18) particles.push(new Particle(this.x,this.y, -this.vx*0.2+randRange(-0.4,0.4), -this.vy*0.2+randRange(-0.4,0.4), 180, 'rgba(167,139,250,0.55)',1.4));
    return !this.dead;
  }
  draw(ctx){
    const x=this.x-this.w/2, y=this.y-this.h/2, bob=Math.sin(this.anim*0.010)*1.1;
    const isFlash=this.hitFlash>0 && Math.floor(this.hitFlash/40)%2===0;
    const pulse=0.5+Math.sin(this.anim*0.012)*0.28;
    // aura bispo premium - diagonal violeta com anel duplo
    ctx.fillStyle=isFlash?'rgba(255,255,255,0.18)':`rgba(167,139,250,${0.12+pulse*0.08})`;
    ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.88+pulse*2.4,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=`rgba(167,139,250,${0.20+pulse*0.10})`; ctx.lineWidth=1.1; ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.78,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.fillRect(x+2, y+this.h-3, this.w,3);
    // corpo bispo com gradiente vertical
    ctx.fillStyle=isFlash?'#fff':'#6d28d9'; ctx.fillRect(x+4, y+5+bob, this.w-8, this.h-9);
    ctx.fillStyle=isFlash?'#e9d5ff':'#a78bfa'; ctx.fillRect(x+4, y+5+bob, 2, this.h-9);
    ctx.fillStyle=isFlash?'#4c1d95':'#3b0f8a'; ctx.fillRect(x+this.w-6, y+5+bob, 2, this.h-9);
    // faixa central dourada sutil
    ctx.fillStyle=isFlash?'#fff8a0':'#c084fc'; ctx.fillRect(x+6, y+3+bob, this.w-12, 5);
    ctx.fillStyle='rgba(255,255,255,0.32)'; ctx.fillRect(x+6, y+3+bob, this.w-12,1);
    // mitra do bispo estilizada com vinco e gema
    ctx.fillStyle=isFlash?'#fff':'#e9d5ff'; ctx.beginPath(); ctx.moveTo(this.x, y+1.2+bob); ctx.lineTo(x+5.5, y+9.5+bob); ctx.lineTo(x+this.w-5.5, y+9.5+bob); ctx.closePath(); ctx.fill();
    ctx.fillStyle=isFlash?'#f5e6ff':'#a78bfa'; ctx.beginPath(); ctx.moveTo(this.x, y+1.2+bob); ctx.lineTo(x+7, y+9.5+bob); ctx.lineTo(x+this.w-7, y+9.5+bob); ctx.closePath(); ctx.fill();
    // vinco central mitra
    ctx.strokeStyle='rgba(0,0,0,0.18)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(this.x, y+1.2+bob); ctx.lineTo(this.x, y+9.5+bob); ctx.stroke();
    // gema central
    ctx.fillStyle=isFlash?'#fff':'#ffd700'; ctx.beginPath(); ctx.arc(this.x, y+6+bob, 1.8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(this.x-0.5, y+5.5+bob, 0.7,0,Math.PI*2); ctx.fill();
    // símbolo ♝ com sombra
    ctx.shadowColor='rgba(0,0,0,0.42)'; ctx.shadowBlur=3;
    ctx.fillStyle=isFlash?'#4c1d95':'#fff'; ctx.font='bold 12px sans-serif'; ctx.textAlign='center'; ctx.fillText('♝', this.x, y+15.5+bob); ctx.textAlign='left';
    ctx.shadowBlur=0;
    // detalhe diagonal sutil no manto (linha)
    ctx.strokeStyle='rgba(255,255,255,0.14)'; ctx.lineWidth=0.8; ctx.beginPath(); ctx.moveTo(x+4, y+14+bob); ctx.lineTo(x+this.w-4, y+7+bob); ctx.stroke();
    if(this.hp < this.maxHp){
      const pct=clamp(this.hp/this.maxHp,0,1);
      ctx.fillStyle='rgba(0,0,0,0.68)'; ctx.fillRect(x, y-8+bob, this.w,4.5);
      ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.fillRect(x+1, y-7+bob, this.w-2,2.5);
      ctx.fillStyle=pct>0.5?'#a78bfa':pct>0.3?'#facc15':'#ef4444'; ctx.fillRect(x+1, y-7+bob, (this.w-2)*pct,2.5);
      ctx.strokeStyle='rgba(255,255,255,0.10)'; ctx.lineWidth=0.8; ctx.strokeRect(x, y-8+bob, this.w,4.5);
    }
    // rastro diagonal estilizado com seta
    const trailLen=10;
    ctx.strokeStyle=`rgba(167,139,250,${0.42})`; ctx.lineWidth=1.2; ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.moveTo(this.x-this.vx*trailLen*0.6, this.y-bob-this.vy*trailLen*0.6); ctx.lineTo(this.x+this.vx*4, this.y+bob+this.vy*4); ctx.stroke(); ctx.setLineDash([]);
    // ponta seta no fim do rastro
    const tx=this.x+this.vx*4, ty=this.y+bob+this.vy*4;
    ctx.fillStyle='rgba(167,139,250,0.88)'; ctx.beginPath(); ctx.arc(tx, ty, 1.8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(tx, ty, 0.8,0,Math.PI*2); ctx.fill();
  }
  getRect(){ return {x:this.x-this.w/2, y:this.y-this.h/2, w:this.w, h:this.h}; }
}

class RainhaPiece {
  constructor(x, y, owner){
    this.x=x; this.y=y; this.owner=owner; this.w=28; this.h=28;
    this.hp=OLI_RAINHA_HP; this.maxHp=OLI_RAINHA_HP; this.damage=OLI_RAINHA_DAMAGE;
    this.speed=OLI_RAINHA_SPEED; this.life=OLI_RAINHA_LIFE; this.maxLife=OLI_RAINHA_LIFE;
    this.dead=false; this.anim=Math.random()*1000; this.hitFlash=0;
    this.type='rainha'; this.isChessPiece=true; this.ownerId=owner?owner.characterId:null;
    this.shootCooldown=0; this.target=null;
  }
  takeDamage(dmg){ this.hp-=dmg; this.hitFlash=140; if(this.hp<=0){this.dead=true; return true;} return false; }
  update(dt, enemies, walls, particles, bulletsOut, player){
    this.life-=dt; this.anim+=dt; if(this.hitFlash>0) this.hitFlash-=dt; if(this.shootCooldown>0) this.shootCooldown-=dt;
    if(this.life<=0){this.dead=true; return false;}
    if(this.dead) return false;
    // busca inimigo mais próximo
    let best=null, bestD=OLI_RAINHA_RANGE;
    for(const e of enemies){
      if(e.dead) continue;
      const d=dist(this.x,this.y,e.x,e.y);
      if(d < bestD){ best=e; bestD=d; }
    }
    this.target=best;
    if(best){
      const dx=best.x - this.x, dy=best.y - this.y;
      const d=Math.hypot(dx,dy)||1;
      if(d > 75){
        const n=normalize(dx,dy);
        let nx=this.x + n.x*this.speed;
        let ny=this.y + n.y*this.speed;
        let canX=true, canY=true;
        for(const w of walls){
          if(rectCollide(nx-this.w/2, this.y-this.h/2, this.w, this.h, w.x,w.y,w.w,w.h)) canX=false;
          if(rectCollide(this.x-this.w/2, ny-this.h/2, this.w, this.h, w.x,w.y,w.w,w.h)) canY=false;
        }
        if(canX) this.x=nx;
        if(canY) this.y=ny;
      }
      // dispara se cooldown e linha de visão
      if(this.shootCooldown<=0 && d < OLI_RAINHA_RANGE && d > 40){
        let blocked=false;
        for(const w of walls){
          // checa se parede bloqueia linha
          const steps=6;
          for(let i=1;i<steps;i++){
            const sx=lerp(this.x, best.x, i/steps), sy=lerp(this.y, best.y, i/steps);
            if(rectCollide(sx-2,sy-2,4,4,w.x,w.y,w.w,w.h)){blocked=true;break;}
          }
          if(blocked) break;
        }
        if(!blocked){
          const dir=normalize(dx,dy);
          const ang=Math.atan2(dir.y,dir.x)+randRange(-0.08,0.08);
          const bdx=Math.cos(ang), bdy=Math.sin(ang);
          bulletsOut.push(new Bullet(this.x, this.y, bdx, bdy, 'player', {
            speed: OLI_RAINHA_BULLET_SPEED,
            damage: this.damage,
            range: OLI_RAINHA_RANGE,
            size: 5,
            color: '#c084fc',
            glow: 'rgba(192,132,252,0.32)'
          }));
          this.shootCooldown=OLI_RAINHA_SHOOT_COOLDOWN;
          if(particles) for(let k=0;k<3;k++) particles.push(new Particle(this.x, this.y, bdx*randRange(0.8,1.4)+randRange(-0.3,0.3), bdy*randRange(0.8,1.4)+randRange(-0.3,0.3), 180, '#c084fc',1.6));
        }
      }
    } else {
      // patrulha leve
      this.x+=Math.sin(this.anim*0.002)*0.6;
      this.y+=Math.cos(this.anim*0.0022)*0.5;
    }
    this.x=clamp(this.x, WALL_THICK+this.w/2, CANVAS_W-WALL_THICK-this.w/2);
    this.y=clamp(this.y, WALL_THICK+this.h/2, CANVAS_H-WALL_THICK-this.h/2);
    // colisão com inimigos (corpo)
    for(const e of enemies){
      if(e.dead) continue;
      if(rectCollide(this.x-this.w/2, this.y-this.h/2, this.w, this.h, e.x-e.w/2, e.y-e.h/2, e.w, e.h)){
        const died=e.takeDamage(this.damage*0.5);
        e.hitFlash=100;
        if(particles) for(let k=0;k<3;k++) particles.push(new Particle(e.x,e.y, randRange(-1,1), randRange(-1,0.4), 160, '#c084fc',1.4));
      }
    }
    return !this.dead;
  }
  draw(ctx){
    const x=this.x-this.w/2, y=this.y-this.h/2, bob=Math.sin(this.anim*0.009)*1.4;
    const isFlash=this.hitFlash>0 && Math.floor(this.hitFlash/40)%2===0;
    const pulse=0.5+Math.sin(this.anim*0.012)*0.32;
    // aura rainha premium - violeta real com brilho duplo
    ctx.fillStyle=isFlash?'rgba(255,255,255,0.16)':`rgba(192,132,252,${0.14+pulse*0.09})`;
    ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.96+pulse*3.2,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=`rgba(192,132,252,${0.22+pulse*0.12})`; ctx.lineWidth=1.1; ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.82,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle='rgba(0,0,0,0.30)'; ctx.fillRect(x+2, y+this.h-3, this.w,3);
    // corpo rainha com gradiente e cinto
    ctx.fillStyle=isFlash?'#fff':'#8b5cf6'; ctx.fillRect(x+3, y+5+bob, this.w-6, this.h-9);
    ctx.fillStyle=isFlash?'#f5d0ff':'#c4b5fd'; ctx.fillRect(x+3, y+5+bob, 2, this.h-9);
    ctx.fillStyle=isFlash?'#4c1d95':'#4c1d95'; ctx.fillRect(x+this.w-5, y+5+bob, 2, this.h-9);
    // faixa cintura
    ctx.fillStyle=isFlash?'#ffed4e':'#ffd700'; ctx.fillRect(x+5, y+13+bob, this.w-10, 2);
    ctx.fillStyle='rgba(255,255,255,0.42)'; ctx.fillRect(x+5, y+13+bob, this.w-10,0.7);
    // gola alta
    ctx.fillStyle=isFlash?'#f5d0ff':'#4c1d95'; ctx.fillRect(x+5, y+3+bob, this.w-10, 6);
    ctx.fillStyle='rgba(255,255,255,0.22)'; ctx.fillRect(x+5, y+3+bob, this.w-10,1);
    // coroa rainha premium com gemas
    ctx.fillStyle=isFlash?'#fff':'#ffd700'; ctx.fillRect(x+3, y+1+bob, this.w-6, 5);
    ctx.fillStyle='#ffed4e'; for(let i=0;i<3;i++){ const cx=x+7+i*7; ctx.fillRect(cx, y+0.5+bob, 3.5,2.5); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(cx+1.7, y+1.5+bob, 0.7,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#ffed4e'; }
    // gema central coroa
    ctx.fillStyle=isFlash?'#fff':'#ff2d75'; ctx.beginPath(); ctx.arc(this.x, y+2+bob, 1.9,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(this.x-0.5, y+1.6+bob, 0.6,0,Math.PI*2); ctx.fill();
    // manto leve
    ctx.fillStyle='rgba(192,132,252,0.14)'; ctx.fillRect(x+1, y+6+bob, 2, this.h-10);
    ctx.fillRect(x+this.w-3, y+6+bob, 2, this.h-10);
    // símbolo ♛ com sombra e brilho
    ctx.shadowColor='rgba(0,0,0,0.45)'; ctx.shadowBlur=4;
    ctx.fillStyle=isFlash?'#4c1d95':'#fff'; ctx.font='bold 13px sans-serif'; ctx.textAlign='center'; ctx.fillText('♛', this.x, y+16+bob); ctx.textAlign='left';
    ctx.shadowBlur=0;
    if(this.hp < this.maxHp){
      const pct=clamp(this.hp/this.maxHp,0,1);
      ctx.fillStyle='rgba(0,0,0,0.68)'; ctx.fillRect(x, y-8+bob, this.w,4.5);
      ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.fillRect(x+1, y-7+bob, this.w-2,2.5);
      ctx.fillStyle=pct>0.5?'#c084fc':pct>0.3?'#facc15':'#ef4444'; ctx.fillRect(x+1, y-7+bob, (this.w-2)*pct,2.5);
      ctx.strokeStyle='rgba(255,255,255,0.10)'; ctx.lineWidth=0.8; ctx.strokeRect(x, y-8+bob, this.w,4.5);
    }
    // linha de mira até alvo com brilho e ponta
    if(this.target){
      const mx=this.target.x, my=this.target.y;
      ctx.strokeStyle='rgba(192,132,252,0.28)'; ctx.lineWidth=1.2; ctx.setLineDash([4,3]);
      ctx.beginPath(); ctx.moveTo(this.x, this.y+bob); ctx.lineTo(mx, my); ctx.stroke(); ctx.setLineDash([]);
      // ponto alvo pulsante
      const tp=0.5+Math.sin(this.anim*0.018)*0.3;
      ctx.fillStyle=`rgba(192,132,252,${0.55+tp*0.25})`; ctx.beginPath(); ctx.arc(mx, my, 3+tp*1.2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.92)'; ctx.beginPath(); ctx.arc(mx, my, 1.2,0,Math.PI*2); ctx.fill();
      // cano sutil da rainha apontando
      const ang=Math.atan2(my-(this.y+bob), mx-this.x);
      ctx.strokeStyle='rgba(255,255,255,0.22)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(this.x, this.y+bob); ctx.lineTo(this.x+Math.cos(ang)*12, this.y+bob+Math.sin(ang)*12); ctx.stroke();
    }
  }
  getRect(){ return {x:this.x-this.w/2, y:this.y-this.h/2, w:this.w, h:this.h}; }
}

class ReiPiece {
  constructor(x, y, owner, pawnArrayRef){
    this.x=x; this.y=y; this.owner=owner; this.pawnArrayRef=pawnArrayRef; this.w=28; this.h=28;
    this.hp=OLI_REI_HP; this.maxHp=OLI_REI_HP; this.damage=OLI_REI_DAMAGE;
    this.speed=OLI_REI_SPEED; this.life=OLI_REI_LIFE; this.maxLife=OLI_REI_LIFE;
    this.dead=false; this.anim=Math.random()*1000; this.hitFlash=0;
    this.type='rei'; this.isChessPiece=true; this.ownerId=owner?owner.characterId:null;
    this.spawnCooldown=0; this.pawnsSpawned=0;
  }
  takeDamage(dmg){ this.hp-=dmg; this.hitFlash=140; if(this.hp<=0){this.dead=true; return true;} return false; }
  update(dt, enemies, walls, particles, bulletsOut, player){
    this.life-=dt; this.anim+=dt; if(this.hitFlash>0) this.hitFlash-=dt; if(this.spawnCooldown>0) this.spawnCooldown-=dt;
    if(this.life<=0){this.dead=true; return false;}
    if(this.dead) return false;
    // Rei move lentamente em direção ao inimigo mais próximo ou segue Oli a distância
    let best=null, bestD=220;
    for(const e of enemies){
      if(e.dead) continue;
      const d=dist(this.x,this.y,e.x,e.y);
      if(d < bestD){ best=e; bestD=d; }
    }
    if(best){
      const dx=best.x - this.x, dy=best.y - this.y;
      const d=Math.hypot(dx,dy)||1;
      if(d > 85){
        const n=normalize(dx,dy);
        let nx=this.x + n.x*this.speed*0.7;
        let ny=this.y + n.y*this.speed*0.7;
        let canX=true, canY=true;
        for(const w of walls){
          if(rectCollide(nx-this.w/2, this.y-this.h/2, this.w, this.h, w.x,w.y,w.w,w.h)) canX=false;
          if(rectCollide(this.x-this.w/2, ny-this.h/2, this.w, this.h, w.x,w.y,w.w,w.h)) canY=false;
        }
        if(canX) this.x=nx;
        if(canY) this.y=ny;
      }
    } else if(player){
      // segue Oli a distância
      const dx=player.x - this.x, dy=player.y - this.y;
      const d=Math.hypot(dx,dy)||1;
      if(d > 70){
        const n=normalize(dx,dy);
        this.x+=n.x*this.speed*0.6;
        this.y+=n.y*this.speed*0.6;
      } else {
        this.x+=Math.sin(this.anim*0.0015)*0.4;
        this.y+=Math.cos(this.anim*0.0015)*0.4;
      }
    }
    this.x=clamp(this.x, WALL_THICK+this.w/2, CANVAS_W-WALL_THICK-this.w/2);
    this.y=clamp(this.y, WALL_THICK+this.h/2, CANVAS_H-WALL_THICK-this.h/2);
    // Invoca peões periodicamente ou na criação
    if(this.pawnsSpawned===0){
      // spawn inicial imediato de 3 peões
      for(let i=0;i<OLI_PAWN_COUNT_ON_KING;i++){
        const ang=(i/OLI_PAWN_COUNT_ON_KING)*Math.PI*2;
        const px=this.x+Math.cos(ang)*22, py=this.y+Math.sin(ang)*22;
        let safeX=px, safeY=py, tries=0;
        while(tries<8){
          let onWall=false;
          for(const w of walls) if(rectCollide(safeX-8,safeY-8,16,16,w.x,w.y,w.w,w.h)){onWall=true;break;}
          if(!onWall) break;
          safeX=this.x+randRange(-24,24); safeY=this.y+randRange(-24,24); tries++;
        }
        const pawn=new PeaoPiece(safeX,safeY, this.owner);
        if(this.pawnArrayRef) this.pawnArrayRef.push(pawn);
        else if(particles && particles._pawnArray) particles._pawnArray.push(pawn);
        if(particles) for(let k=0;k<8;k++) particles.push(new Particle(safeX,safeY, Math.cos(ang)*randRange(1,2.5)+randRange(-0.4,0.4), Math.sin(ang)*randRange(1,2.5)+randRange(-0.4,0.4), 260, '#d1d5db',1.8));
      }
      this.pawnsSpawned=3;
      this.spawnCooldown=4200;
    } else if(this.spawnCooldown<=0 && this.pawnArrayRef && this.pawnArrayRef.length < 6){
      // respawn ocasional de 1 peão se houver poucos
      const ang=Math.random()*Math.PI*2;
      const px=this.x+Math.cos(ang)*18, py=this.y+Math.sin(ang)*18;
      const pawn=new PeaoPiece(px,py,this.owner);
      this.pawnArrayRef.push(pawn);
      if(particles) for(let k=0;k<6;k++) particles.push(new Particle(px,py, randRange(-1,1), randRange(-1,0.6), 220, '#d1d5db',1.6));
      this.spawnCooldown=5000;
    }
    return !this.dead;
  }
  draw(ctx){
    const x=this.x-this.w/2, y=this.y-this.h/2, bob=Math.sin(this.anim*0.008)*1.2;
    const isFlash=this.hitFlash>0 && Math.floor(this.hitFlash/40)%2===0;
    const pulse=0.5+Math.sin(this.anim*0.010)*0.30;
    // aura rei premium - ouro real com anel duplo e capa
    ctx.fillStyle=isFlash?'rgba(255,255,255,0.16)':`rgba(255,215,0,${0.14+pulse*0.09})`;
    ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*1.02+pulse*3.4,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=`rgba(255,215,0,${0.20+pulse*0.12})`; ctx.lineWidth=1.2; ctx.setLineDash([5,3]);
    ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.88,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle='rgba(0,0,0,0.30)'; ctx.fillRect(x+2, y+this.h-3, this.w,3);
    // corpo rei com manto real
    ctx.fillStyle=isFlash?'#fff':'#d4a017'; ctx.fillRect(x+3, y+5+bob, this.w-6, this.h-9);
    ctx.fillStyle=isFlash?'#fff8a0':'#ffd700'; ctx.fillRect(x+3, y+5+bob, 2.2, this.h-9);
    ctx.fillStyle=isFlash?'#a16207':'#7a4a00'; ctx.fillRect(x+this.w-5.2, y+5+bob, 2.2, this.h-9);
    // faixa peitoral ouro
    ctx.fillStyle=isFlash?'#fff8a0':'#a16207'; ctx.fillRect(x+5, y+3+bob, this.w-10, 6);
    ctx.fillStyle='rgba(255,255,255,0.28)'; ctx.fillRect(x+5, y+3+bob, this.w-10,1);
    // capa real atrás
    ctx.fillStyle='rgba(127,29,29,0.22)'; ctx.fillRect(x-1, y+6+bob, 3, this.h-8);
    ctx.fillRect(x+this.w-2, y+6+bob, 3, this.h-8);
    // coroa rei alta premium com joia
    ctx.fillStyle=isFlash?'#fff':'#ffd700'; ctx.fillRect(x+5, y+0.5+bob, this.w-10, 5.5);
    ctx.fillStyle='#ffed4e'; ctx.fillRect(x+4, y+2+bob, 2.2,3.2); ctx.fillRect(x+this.w-6.2, y+2+bob, 2.2,3.2);
    // dentes coroa com brilho
    for(let i=0;i<3;i++){ const cx=x+9+i*6; ctx.fillStyle='#fff8a0'; ctx.fillRect(cx, y+0.5+bob, 2,1); ctx.fillStyle='#ffd700'; ctx.fillRect(cx, y+1.5+bob, 2,0.8); }
    // joia central coroa
    ctx.fillStyle='#ff2d55'; ctx.beginPath(); ctx.arc(this.x, y+2+bob, 1.9,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(this.x-0.5, y+1.6+bob, 0.7,0,Math.PI*2); ctx.fill();
    // símbolo ♚ com sombra
    ctx.shadowColor='rgba(0,0,0,0.45)'; ctx.shadowBlur=4;
    ctx.fillStyle=isFlash?'#7a4a00':'#fff'; ctx.font='bold 13px sans-serif'; ctx.textAlign='center'; ctx.fillText('♚', this.x, y+16+bob); ctx.textAlign='left';
    ctx.shadowBlur=0;
    if(this.hp < this.maxHp){
      const pct=clamp(this.hp/this.maxHp,0,1);
      ctx.fillStyle='rgba(0,0,0,0.68)'; ctx.fillRect(x, y-8+bob, this.w,4.5);
      ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.fillRect(x+1, y-7+bob, this.w-2,2.5);
      ctx.fillStyle=pct>0.5?'#ffd700':pct>0.3?'#facc15':'#ef4444'; ctx.fillRect(x+1, y-7+bob, (this.w-2)*pct,2.5);
      ctx.strokeStyle='rgba(255,255,255,0.10)'; ctx.lineWidth=0.8; ctx.strokeRect(x, y-8+bob, this.w,4.5);
    }
    // aura de comando premium
    ctx.strokeStyle=`rgba(255,215,0,${0.18+pulse*0.08})`; ctx.lineWidth=1.2; ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.arc(this.x, this.y+bob, 22+pulse*2,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
  }
  getRect(){ return {x:this.x-this.w/2, y:this.y-this.h/2, w:this.w, h:this.h}; }
}

class PeaoPiece {
  constructor(x, y, owner){
    this.x=x; this.y=y; this.owner=owner; this.w=19; this.h=19;
    this.hp=OLI_PAWN_HP; this.maxHp=OLI_PAWN_HP; this.damage=OLI_PAWN_DAMAGE;
    this.speed=OLI_PAWN_SPEED; this.life=OLI_PAWN_LIFE; this.maxLife=OLI_PAWN_LIFE;
    this.dead=false; this.anim=Math.random()*1000; this.hitFlash=0;
    this.type='peao'; this.isChessPiece=true; this.isPawn=true; this.ownerId=owner?owner.characterId:null;
    this.target=null; this.attackCooldown=0;
    this.kills=0; this.promoted=false; // promoção após abates
    this.shieldReduction=OLI_PAWN_SHIELD_REDUCTION;
  }
  takeDamage(dmg){
    const reduced = dmg * (1 - this.shieldReduction);
    this.hp-=reduced; this.hitFlash=140;
    if(this.hp<=0){this.dead=true; return true;}
    return false;
  }
  tryPromote(particles){
    if(this.promoted) return;
    if(this.kills >= OLI_PAWN_PROMOTE_KILLS){
      this.promoted=true;
      this.w=22; this.h=22;
      this.maxHp += 3; this.hp = this.maxHp;
      this.damage *= 1.32;
      this.speed *= 1.12;
      this.hitFlash=220;
      if(particles){
        for(let k=0;k<14;k++){ const ang=Math.random()*Math.PI*2; particles.push(new Particle(this.x,this.y, Math.cos(ang)*randRange(1.4,3.2), Math.sin(ang)*randRange(1.4,3.2), 320, '#ffd700', 2.4)); }
        for(let k=0;k<6;k++) particles.push(new Particle(this.x,this.y, randRange(-1.2,1.2), randRange(-1.4,0.4), 260, '#ffffff', 1.8));
      }
    }
  }
  update(dt, enemies, walls, particles){
    this.life-=dt; this.anim+=dt; if(this.hitFlash>0) this.hitFlash-=dt; if(this.attackCooldown>0) this.attackCooldown-=dt;
    if(this.life<=0){this.dead=true; return false;}
    if(this.dead) return false;
    // busca inimigo mais próximo (raio aumentado)
    let best=null, bestD=300;
    for(const e of enemies){
      if(e.dead) continue;
      const d=dist(this.x,this.y,e.x,e.y);
      if(d < bestD){ best=e; bestD=d; }
    }
    this.target=best;
    if(best){
      const dx=best.x - this.x, dy=best.y - this.y;
      const d=Math.hypot(dx,dy)||1;
      if(d < 15){
        if(this.attackCooldown<=0){
          const died=best.takeDamage(this.damage);
          this.attackCooldown= this.promoted? 340 : 400; // promovido ataca mais rápido
          this.hitFlash=110;
          best.x+= (dx/d)*6; best.y+= (dy/d)*6;
          best.hitFlash = Math.max(best.hitFlash||0, 110);
          // 18% chance de atordoar
          if(best.stunTimer!==undefined && Math.random() < OLI_PAWN_STUN_CHANCE){
            best.stunTimer = Math.max(best.stunTimer||0, 340);
            if(particles) for(let k=0;k<3;k++) particles.push(new Particle(best.x, best.y-6, randRange(-0.6,0.6), -0.8, 220, '#ffd700', 1.6));
          }
          if(particles){
            for(let k=0;k<5;k++) particles.push(new Particle(best.x,best.y, randRange(-1.2,1.2), randRange(-1,0.4), 200, this.promoted?'#ffd700':'#d1d5db',1.6));
            if(died) for(let k=0;k<10;k++){const ang=Math.random()*Math.PI*2; particles.push(new Particle(best.x,best.y, Math.cos(ang)*randRange(1.4,3), Math.sin(ang)*randRange(1.4,3), 300, this.promoted?'#ffd700':'#d1d5db',2));}
          }
          if(died){
            this.kills++;
            this.tryPromote(particles);
            // cura leve ao abater
            this.hp = Math.min(this.maxHp, this.hp + 1.2);
          }
          // desgaste reduzido (antes 0.4) - peão dura mais
          this.hp-=0.12;
          if(this.hp<=0) this.dead=true;
        }
      } else {
        const n=normalize(dx,dy);
        let nx=this.x + n.x*this.speed;
        let ny=this.y + n.y*this.speed;
        let canX=true, canY=true;
        for(const w of walls){
          if(rectCollide(nx-this.w/2, this.y-this.h/2, this.w, this.h, w.x,w.y,w.w,w.h)) canX=false;
          if(rectCollide(this.x-this.w/2, ny-this.h/2, this.w, this.h, w.x,w.y,w.w,w.h)) canY=false;
        }
        if(canX) this.x=nx;
        if(canY) this.y=ny;
        // leve desvio se travado
        if(!canX && !canY){
          this.x += Math.sin(this.anim*0.008)*0.6;
          this.y += Math.cos(this.anim*0.008)*0.6;
        }
      }
    } else {
      // patrulha suave perto do rei/jogador
      this.x+=Math.sin(this.anim*0.0022)*0.55;
      this.y+=Math.cos(this.anim*0.0022)*0.55;
      // regeneração passiva lenta se promovido
      if(this.promoted && Math.random()<0.02) this.hp = Math.min(this.maxHp, this.hp + 0.05);
    }
    this.x=clamp(this.x, WALL_THICK+this.w/2, CANVAS_W-WALL_THICK-this.w/2);
    this.y=clamp(this.y, WALL_THICK+this.h/2, CANVAS_H-WALL_THICK-this.h/2);
    return !this.dead;
  }
  draw(ctx){
    const x=this.x-this.w/2, y=this.y-this.h/2, bob=Math.sin(this.anim*0.012)*1.1;
    const isFlash=this.hitFlash>0 && Math.floor(this.hitFlash/40)%2===0;
    const isPromoted=this.promoted;
    // sombra
    ctx.fillStyle='rgba(0,0,0,0.24)'; ctx.fillRect(x+2, y+this.h-3, this.w,2.5);
    // aura promovida
    if(isPromoted){
      const pulse=0.5+Math.sin(this.anim*0.014)*0.32;
      ctx.fillStyle=`rgba(255,215,0,${0.14+pulse*0.08})`;
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.78+pulse*2.2,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle=`rgba(255,215,0,${0.42+pulse*0.18})`; ctx.lineWidth=1.2;
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.72,0,Math.PI*2); ctx.stroke();
    }
    // corpo peão - base metálica, promovido dourado
    ctx.fillStyle=isFlash?'#fff': isPromoted?'#ffd700':'#e5e7eb';
    ctx.fillRect(x+3, y+6+bob, this.w-6, this.h-7);
    ctx.fillStyle=isFlash?'#f3f4f6': isPromoted?'#ffcc33':'#9ca3af';
    ctx.fillRect(x+5, y+3+bob, this.w-10, 5);
    // capacete
    ctx.fillStyle=isFlash?'#fff': isPromoted?'#fff8a0':'#f3f4f6';
    ctx.fillRect(x+6, y+1+bob, this.w-12, 3);
    // símbolo
    ctx.fillStyle=isPromoted?'#7a5a00':'#1e293b';
    ctx.font= isPromoted?'11px sans-serif':'10px sans-serif'; ctx.textAlign='center';
    ctx.fillText(isPromoted?'♛':'♟', this.x, y+13+bob); ctx.textAlign='left';
    // faixa kills para promoção
    if(!isPromoted && this.kills>0){
      ctx.fillStyle='rgba(255,215,0,0.92)'; ctx.font='5px monospace'; ctx.textAlign='center';
      ctx.fillText(`${this.kills}/${OLI_PAWN_PROMOTE_KILLS}`, this.x, y-2+bob); ctx.textAlign='left';
      // pontos
      for(let i=0;i<OLI_PAWN_PROMOTE_KILLS;i++){
        ctx.fillStyle=i<this.kills?'#ffd700':'rgba(255,255,255,0.22)';
        ctx.fillRect(x+4+i*6, y+2+bob, 4, 2);
      }
    }
    if(isPromoted){
      ctx.fillStyle='rgba(255,215,0,0.96)'; ctx.font='5px monospace'; ctx.textAlign='center';
      ctx.fillText('PROMOVIDO', this.x, y-4+bob); ctx.textAlign='left';
    }
    // escudo indicador
    ctx.fillStyle='rgba(96,165,250,0.62)'; ctx.font='5px monospace'; ctx.textAlign='center';
    ctx.fillText('🛡︎', this.x, y+5+bob); ctx.textAlign='left';
    if(this.hp < this.maxHp){
      const pct=clamp(this.hp/this.maxHp,0,1);
      ctx.fillStyle='rgba(0,0,0,0.62)'; ctx.fillRect(x, y-7+bob, this.w,3.2);
      ctx.fillStyle= isPromoted? (pct>0.5?'#ffd700':'#ff8c42') : (pct>0.5?'#d1d5db':'#ef4444'); ctx.fillRect(x, y-7+bob, this.w*pct,3.2);
      ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=0.8; ctx.strokeRect(x, y-7+bob, this.w,3.2);
    }
    // vida tempo
    const lifePct=clamp(this.life/this.maxLife,0,1);
    if(lifePct<0.35){
      ctx.fillStyle='rgba(255,255,255,0.62)'; ctx.font='4px monospace'; ctx.textAlign='center';
      ctx.fillText(`${Math.ceil(this.life/1000)}s`, this.x, y+this.h+4+bob); ctx.textAlign='left';
    }
  }
  getRect(){ return {x:this.x-this.w/2, y:this.y-this.h/2, w:this.w, h:this.h}; }
}
// ===================== SPEAR PROJECTILE (REMOVIDO - Lança retirada) =====================
class SpearProjectile {
  constructor(x,y,dirX,dirY,opts={}){
    this.x=x; this.y=y; this.dirX=dirX; this.dirY=dirY;
    this.speed=opts.speed||11.8; this.maxRange=opts.range||400; this.damage=opts.damage||2.6; this.returnDamage=opts.returnDamage||1.2;
    this.size=opts.size||7; this.color=opts.color||'#c0a080'; this.glow=opts.glow||'rgba(192,160,128,0.22)';
    this.owner='player'; this.traveled=0; this.returning=false; this.dead=false;
    this.hitEnemies=new Set(); this.pierce=opts.pierce||99; this.life=3800; this.trail=[];
  }
  update(dt, player, walls, particles){
    this.life-=dt; if(this.life<=0){ this.dead=true; return false; }
    this.trail.push({x:this.x,y:this.y,life:180}); if(this.trail.length>7) this.trail.shift(); for(const t of this.trail) t.life-=dt; this.trail=this.trail.filter(t=>t.life>0);
    if(!this.returning){
      const dx=this.dirX*this.speed, dy=this.dirY*this.speed;
      this.x+=dx; this.y+=dy; this.traveled+=Math.hypot(dx,dy);
      for(const w of walls){ if(circleRectCollide(this.x,this.y,this.size,w.x,w.y,w.w,w.h)){ this.returning=true; break; } }
      if(this.traveled>=this.maxRange) this.returning=true;
      if(dist(this.x,this.y,player.x,player.y)>this.maxRange+60) this.returning=true;
    } else {
      const toPx=player.x-this.x, toPy=player.y-this.y; const d=Math.hypot(toPx,toPy);
      if(d<16){ this.dead=true; if(particles) for(let k=0;k<7;k++) particles.push(new Particle(this.x,this.y, randRange(-1.2,1.2), randRange(-1.2,0.4), 180, this.color, 1.8)); return false; }
      const n=normalize(toPx,toPy); const retSpeed=this.speed*1.32; this.x+=n.x*retSpeed; this.y+=n.y*retSpeed; this.dirX=n.x; this.dirY=n.y;
    }
    if(this.x<-24||this.x>CANVAS_W+24||this.y<-24||this.y>CANVAS_H+24){ if(this.returning) this.dead=true; else this.returning=true; }
    return !this.dead;
  }
  draw(ctx){
    for(const t of this.trail){ const a=t.life/180; ctx.fillStyle=`rgba(192,160,128,${a*0.18})`; ctx.beginPath(); ctx.arc(t.x,t.y,2.5*a,0,Math.PI*2); ctx.fill(); }
    const ang=Math.atan2(this.dirY,this.dirX);
    const len=22;
    ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(ang);
    // brilho
    ctx.fillStyle=this.glow; ctx.beginPath(); ctx.ellipse(0,0,len,3.5,0,0,Math.PI*2); ctx.fill();
    // haste
    ctx.fillStyle='#6b4a1a'; ctx.fillRect(-len+2,-1.2,len-6,2.4);
    ctx.fillStyle='#8a6d3b'; ctx.fillRect(-len+6,-0.7,len-10,1.4);
    // ponta
    ctx.fillStyle='#e8e8e8'; ctx.beginPath(); ctx.moveTo(len-2,0); ctx.lineTo(len-10,-4); ctx.lineTo(len-10,4); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.moveTo(len-4,0); ctx.lineTo(len-9,-1.8); ctx.lineTo(len-9,1.8); ctx.closePath(); ctx.fill();
    // guarda
    ctx.fillStyle='#3a3a4a'; ctx.fillRect(-6,-3.5,4,7);
    // brilho ponta
    ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(len-6,0,1.2,0,Math.PI*2); ctx.fill();
    ctx.restore();
    if(!this.returning){
      ctx.fillStyle='rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(this.x-this.dirX*8,this.y-this.dirY*8,1.4,0,Math.PI*2); ctx.fill();
    }
  }
  getRect(){ return {x:this.x-this.size,y:this.y-this.size,w:this.size*2,h:this.size*2}; }
}

// ===================== ITEM (Sistema genérico) =====================
// Arquitetura extensível: Item -> HealingItem, WeaponItem (futuro: SpeedUp, MaxHpUp, Coin...)
class Item {
  constructor(x, y, w, h, type) {
    this.x = x; this.y = y;
    this.w = w; this.h = h;
    this.type = type; // 'heal_small','heal_large','shotgun'
    this.collected = false;
    this.anim = Math.random()*Math.PI*2;
    this.bob = 0;
    this.spawnDelay = 180; // evita coleta instantânea ao nascer em cima do player
  }
  update(dt, player, globalParticles) {
    this.anim += dt * 0.005;
    this.bob = Math.sin(this.anim * 2) * 3;
    if (this.spawnDelay > 0) { this.spawnDelay -= dt; return false; }
    // colisão com jogador (AABB)
    if (rectCollide(this.x - this.w/2, this.y - this.h/2, this.w, this.h,
                    player.x - player.w/2, player.y - player.h/2, player.w, player.h)) {
      const picked = this.onCollect(player, globalParticles);
      if (picked) {
        this.collected = true;
        return true;
      }
    }
    return false;
  }
  onCollect(player, particles) { return false; } // override
  draw(ctx) {} // override
}

// Coração pequeno: +1 HP (meio coração)
class HealingItem extends Item {
  constructor(x, y, amount = 1) {
    const isLarge = amount >= 2;
    const size = isLarge ? ITEM_SIZE_LARGE_HEART : ITEM_SIZE_SMALL_HEART;
    super(x, y, size, size, isLarge ? 'heal_large' : 'heal_small');
    this.amount = amount;
    this.isLarge = isLarge;
  }
  onCollect(player) {
    if (player.hp >= player.maxHp) return false; // não coleta se vida cheia
    const before = player.hp;
    player.heal(this.amount);
    return player.hp > before;
  }
  draw(ctx) {
    const x = this.x, y = this.y + this.bob;
    const s = this.w;
    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(x, y + s*0.45, s*0.42, 4, 0, 0, Math.PI*2); ctx.fill();
    // brilho de fundo pulsante
    const pulse = 0.5 + Math.sin(this.anim*3)*0.2;
    ctx.fillStyle = this.isLarge ? `rgba(255,59,48,${0.18+pulse*0.12})` : `rgba(255,107,107,${0.15+pulse*0.10})`;
    ctx.beginPath(); ctx.arc(x, y, s*0.65 + pulse*2, 0, Math.PI*2); ctx.fill();

    ctx.save(); ctx.translate(x - s/2, y - s/2);
    // coração usando drawHeartPath
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    drawHeartPath(ctx, 1, 2, s); ctx.fill();
    ctx.fillStyle = this.isLarge ? '#ff3b30' : '#ff6b6b';
    drawHeartPath(ctx, 0, 0, s); ctx.fill();
    // brilho
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(this.isLarge?6:5, 5, this.isLarge?2.2:1.8, 0, Math.PI*2); ctx.fill();
    if (this.isLarge) {
      // destaque grande tem contorno dourado sutil
      ctx.strokeStyle = 'rgba(255,204,0,0.55)';
      ctx.lineWidth = 1.2;
      drawHeartPath(ctx, 0, 0, s); ctx.stroke();
      // +1 indicação
      ctx.fillStyle = '#fff';
      ctx.font = '6px "Press Start 2P"';
      ctx.textAlign='center';
      ctx.fillText('+1', s/2, s+9);
      ctx.textAlign='left';
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(8, 8, 1, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();

    // flutuação partícula sutil
    if (Math.random()<0.07) {
      // não gerar partícula aqui, só visual estático; partículas reais no collect
    }
  }
}

// ===================== CORAÇÃO CIBERNÉTICO (BONE HEART) =====================
// Mecânica Bone Heart (Coração Cinza): ocupa 1 recipiente (2 HP) de vida.
// - Coleta: ocupa 1 recipiente. Aumenta maxHp em +2 (recipiente) e cura +2 HP dentro do recipiente.
//   Máximo de recipientes cinza: BONE_HEART_MAX_CONTAINERS (4) -> total máx = base 6 + 8 = 14 HP (7 corações).
// - Dano: Bone Hearts são anexados ao final da barra (direita) e são drenados da direita para a esquerda.
//   Cada recipiente cinza leva 3 hits de ½ coração (ou 2 hits de 1 coração) para quebrar: 2 hits esvaziam os 2 HP vermelhos
//   dentro do osso, o 3º hit (com recipiente já vazio) quebra o osso permanentemente (maxHp -2).
//   Se o recipiente tem apenas ½ coração, dano de 1 coração só esvazia, não quebra (fiel ao Isaac).
// - Cura: pode reencher recipientes cinza vazios antes de quebrarem (HealingItem -> heal).
// - Quebra: recipiente vazio quebra no próximo dano, sem perder vida vermelha (absorve o hit).
// - Visual/nome/sprite preservados (ciano/circuito), apenas lógica alterada.
// - Compatibilidade: migra cyberHp antigo (Soul Heart) para boneHearts se existir save antigo.
class CyberHeartItem extends Item {
  constructor(x, y) {
    super(x, y, ITEM_SIZE_CYBER_HEART, ITEM_SIZE_CYBER_HEART, 'cyber_heart');
    this.amount = CYBER_HEART_HP_AMOUNT; // 2 = 1 recipiente cibernético (Bone Heart)
    this.maxCyber = CYBER_HEART_MAX_CYBER; // limite de HP em Bone (8 = 4 recipientes)
  }
  onCollect(player, particles) {
    // Migração compatibilidade: se save antigo tem cyberHp (Soul), converte para boneHearts
    if(player.boneHearts === undefined) player.boneHearts = 0;
    if(player.maxBoneHearts === undefined) player.maxBoneHearts = BONE_HEART_MAX_CONTAINERS;
    // Migra legacy cyberHp -> boneHearts (1ª vez)
    if(player.cyberHp !== undefined && player.cyberHp > 0 && player.boneHearts === 0){
      const legacyBones = Math.ceil(player.cyberHp / 2);
      const toConvert = Math.min(legacyBones, player.maxBoneHearts);
      player.boneHearts = toConvert;
      // Ajusta maxHp para refletir ossos migrados (base 6 + ossos*2) se ainda não ajustado
      const expectedMax = BONE_HEART_RED_CAPACITY + player.boneHearts * 2;
      if(player.maxHp < expectedMax){
        const diff = expectedMax - player.maxHp;
        player.maxHp = expectedMax;
        player.hp = Math.min(player.maxHp, player.hp + diff);
      }
      player.cyberHp = 0; // limpa legacy
    }
    if(player.boneHearts === undefined) player.boneHearts = 0;
    if(player.maxBoneHearts === undefined) player.maxBoneHearts = BONE_HEART_MAX_CONTAINERS;
    // Se já está no limite de recipientes cinza -> bloqueia coleta
    if (player.boneHearts >= player.maxBoneHearts) {
      try{
        const g = (typeof window!=='undefined' && window.game) ? window.game : null;
        if(g && g.showToast) g.showToast('◆ Corações Cibernéticos máximos! ('+(player.maxBoneHearts)+' recipientes)', 1400);
        if(g) g.shake = Math.max(g.shake||0, 30);
        if(particles){
          for(let k=0;k<6;k++) particles.push(new Particle(this.x, this.y, randRange(-1,1), randRange(-1,0.6), 200, 'rgba(160,160,170,0.85)', 1.2));
        }
      }catch(e){}
      return false; // item permanece no mapa
    }
    // Adiciona 1 recipiente Bone Heart: ocupa container e preenche com 2 HP vermelhos dentro do osso
    player.boneHearts += 1;
    player.maxHp += 2;
    // Cura +2 HP dentro do novo recipiente (até max)
    player.hp = Math.min(player.maxHp, player.hp + 2);
    // Garante limites
    if(player.boneHearts > player.maxBoneHearts) player.boneHearts = player.maxBoneHearts;
    if(player.maxHp > BONE_HEART_RED_CAPACITY + BONE_HEART_MAX_CONTAINERS*2) player.maxHp = BONE_HEART_RED_CAPACITY + BONE_HEART_MAX_CONTAINERS*2;
    if(player.hp > player.maxHp) player.hp = player.maxHp;
    // Mantém cyberHp zerado para compatibilidade visual legada
    player.cyberHp = 0;
    player.maxCyberHp = CYBER_HEART_MAX_CYBER;
    // Feedback visual/sonoro - efeito cibernético cinza (preservado)
    if (particles) {
      for(let k=0;k<16;k++){ const ang=Math.random()*Math.PI*2; particles.push(new Particle(this.x, this.y, Math.cos(ang)*randRange(1.4,3.6), Math.sin(ang)*randRange(1.4,3.6), 380, '#a0a0b0', 2.5)); }
      for(let k=0;k<10;k++) particles.push(new Particle(this.x, this.y, randRange(-1.4,1.4), randRange(-1.2,0.8), 320, '#e0e0e8', 2));
      for(let k=0;k<8;k++) particles.push(new Particle(this.x, this.y, randRange(-1.6,1.6), randRange(-1.6,0.7), 440, 'rgba(160,160,180,0.95)', 1.6));
      // anel cinza tecnológico
      if(typeof window!=='undefined' && window.game && window.game.currentRoom){
        try{ window.game.currentRoom.explosions.push({x:this.x, y:this.y, radius:10, life:320, max:320, isCyberHeart:true}); }catch(e){}
      }
    }
    try{
      const g = (typeof window!=='undefined' && window.game) ? window.game : null;
      if(g){
        g.shake = Math.max(g.shake||0, 65);
        const cur = player.boneHearts, max = player.maxBoneHearts;
        if(g.showToast) g.showToast(`◆ Coração Cibernético! +1 recipiente cinza! [${cur}/${max}]`, 2200);
      }
    }catch(e){}
    return true;
  }
  draw(ctx) {
    const x = this.x, y = this.y + this.bob;
    const s = this.w;
    const pulse = 0.5 + Math.sin(this.anim*2.8)*0.32;
    const strongPulse = pulse > 0.72;
    // sombra no chão
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(x, y + s*0.50, s*0.48, 4.5, 0, 0, Math.PI*2); ctx.fill();
    // glow externo ciano pulsante (duplo para destacar)
    ctx.fillStyle = `rgba(0,229,255,${0.18+pulse*0.12})`;
    ctx.beginPath(); ctx.arc(x, y, s*0.78 + pulse*3.5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = `rgba(0,229,255,${0.12+pulse*0.08})`;
    ctx.beginPath(); ctx.arc(x, y, s*0.62 + pulse*2.2, 0, Math.PI*2); ctx.fill();
    // anel hexagonal tecnológico externo (cibernético)
    ctx.strokeStyle = `rgba(0,229,255,${0.35+pulse*0.18})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for(let i=0;i<6;i++){
      const ang = (i/6)*Math.PI*2 - Math.PI/6 + this.anim*0.0015;
      const px = x + Math.cos(ang)*(s*0.55 + pulse*1.2);
      const py = y + Math.sin(ang)*(s*0.55 + pulse*1.2);
      if(i===0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.stroke();
    // base coração escura
    ctx.save(); ctx.translate(x - s/2, y - s/2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    drawHeartPath(ctx, 1, 1.2, s); ctx.fill();
    // coração cibernético - base azul escura metálica
    ctx.fillStyle = '#0a2e3a';
    drawHeartPath(ctx, 0, 0, s); ctx.fill();
    // interior ciano neon
    ctx.fillStyle = strongPulse ? '#38f0ff' : '#00e5ff';
    ctx.save(); ctx.translate(s*0.5, s*0.5); ctx.scale(0.80, 0.80); ctx.translate(-s*0.5, -s*0.5);
    drawHeartPath(ctx, 0, 0, s); ctx.fill();
    ctx.restore();
    // brilho central (highlight)
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.beginPath(); ctx.arc(s*0.36, s*0.30, 2.4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.58)';
    ctx.beginPath(); ctx.arc(s*0.60, s*0.38, 1.2, 0, Math.PI*2); ctx.fill();
    // circuitos horizontais com quebra (estilo placa)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(s*0.26, s*0.54); ctx.lineTo(s*0.43, s*0.54); ctx.lineTo(s*0.51, s*0.62); ctx.lineTo(s*0.74, s*0.62);
    ctx.stroke();
    ctx.strokeStyle = `rgba(0,229,255,${0.90})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(s*0.26, s*0.54); ctx.lineTo(s*0.43, s*0.54); ctx.lineTo(s*0.51, s*0.62); ctx.lineTo(s*0.74, s*0.62);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s*0.74, s*0.44); ctx.lineTo(s*0.57, s*0.44); ctx.lineTo(s*0.49, s*0.36); ctx.lineTo(s*0.28, s*0.36);
    ctx.stroke();
    // nós de circuito (pinos dourado/branco)
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(s*0.43, s*0.54, 1.4, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(s*0.74, s*0.62, 1.3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(s*0.57, s*0.44, 1.1, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(s*0.28, s*0.36, 1.1, 0, Math.PI*2); ctx.fill();
    // borda neon pulsante
    ctx.strokeStyle = `rgba(0,229,255,${0.62+pulse*0.28})`;
    ctx.lineWidth = 1.4;
    drawHeartPath(ctx, 0, 0, s); ctx.stroke();
    // borda interna branca sutil quando pulsa forte
    if(strongPulse){
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 0.9;
      ctx.save(); ctx.translate(s*0.5, s*0.5); ctx.scale(0.86, 0.86); ctx.translate(-s*0.5, -s*0.5);
      drawHeartPath(ctx, 0, 0, s); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    // indicador "+1 ♥" acima (com contorno para legibilidade)
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - 10, y - s*0.72 - 5, 20, 8);
    ctx.fillStyle = strongPulse ? '#ffffff' : '#00e5ff';
    ctx.font = '7px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText('+1', x, y - s*0.72);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '6px monospace';
    ctx.fillText('CYBER', x, y + s*0.74);
    ctx.textAlign = 'left';
    // cintilância orbital quando pulsa forte
    if (strongPulse) {
      const ang = this.anim*0.018;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(x + Math.cos(ang)*s*0.42, y + Math.sin(ang)*s*0.32, 1.2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(0,229,255,0.95)';
      ctx.beginPath(); ctx.arc(x + Math.cos(ang+Math.PI)*s*0.42, y + Math.sin(ang+Math.PI)*s*0.32, 0.9, 0, Math.PI*2); ctx.fill();
    }
  }
}

// Shotgun / Raio / Metralhadora / Normal / Carregada item: ocupa slot secundário ou troca por proximidade Q
class WeaponItem extends Item {
  constructor(x, y, weaponType='shotgun') {
    const low = weaponType.toString().toLowerCase();
    const isRaio = low==='raio' || low===WEAPON_RAIO.name.toLowerCase();
    const isMini = low==='metralhadora' || low===WEAPON_METRALHADORA.name.toLowerCase();
    const isNormal = low==='normal' || low===WEAPON_NORMAL.name.toLowerCase();
    const isCarregada = low==='carregada' || low===WEAPON_CARREGADA.name.toLowerCase();
    const isBazuca = low==='bazuca' || low===WEAPON_BAZUCA.name.toLowerCase();
    const isEspada = low==='espada' || low===WEAPON_ESPADA.name.toLowerCase();
    const isLuva = low==='luva' || low==='luva_foguete' || low===WEAPON_LUVA.name.toLowerCase();
    const isBastao = low==='bastao' || low===WEAPON_BASTAO.name.toLowerCase();
    const isMotosserra = low==='motosserra' || low===WEAPON_MOTOSSERRA.name.toLowerCase();
    const isRayMatematico = low==='raio_matematico' || low===WEAPON_RAIO_MATEMATICO.name.toLowerCase();
    const isMartelo = false;
    const isLanca = false;
    const isArco = false;
    const isMachado = false;
    let size = ITEM_SIZE_SHOTGUN;
    if(isRaio) size = ITEM_SIZE_RAIO;
    else if(isRayMatematico) size = 22;
    else if(isMini) size = 22;
    else if(isNormal) size = 20;
    else if(isCarregada) size = 20;
    else if(isBazuca) size = 24;
    else if(isEspada) size = ITEM_SIZE_ESPADA;
    else if(isLuva) size = ITEM_SIZE_LUVA;
    else if(isBastao) size = ITEM_SIZE_BASTAO;
    else if(isMotosserra) size = ITEM_SIZE_MOTOSSERRA;
    // martelo/lanca/arco/machado removidos
    super(x, y, size, size, weaponType);
    this.weaponType = weaponType;
    this.isRaio = isRaio;
    this.isMini = isMini;
    this.isNormal = isNormal;
    this.isCarregada = isCarregada;
    this.isBazuca = isBazuca;
    this.isEspada = isEspada;
    this.isLuva = isLuva;
    this.isBastao = isBastao;
    this.isMotosserra = isMotosserra;
    this.isRayMatematico = isRayMatematico;
    this.isMartelo = isMartelo;
    this.isLanca = isLanca;
    this.isArco = isArco;
    this.isMachado = isMachado;
  }
  onCollect(player) {
    // Troca de armas agora é exclusivamente via tecla Q quando próximo (requisito).
    // Evita coleta automática por colisão, duplicação e criação infinita.
    // Retorna false para não remover o item automaticamente; a troca é feita em Game.trySwapNearbyWeapon().
    // Itens não-arma (cura, etc.) continuam com coleta automática em suas subclasses.
    return false;
  }
  draw(ctx) {
    try{
    if(this.isRaio){
      const x=this.x, y=this.y + this.bob, s=this.w;
      const pulse = 0.5 + Math.sin(this.anim*2.2)*0.35;
      ctx.fillStyle='rgba(0,0,0,0.28)';
      ctx.beginPath(); ctx.ellipse(x, y+ s*0.5, s*0.5, 4, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle=`rgba(0,229,255,${0.20+pulse*0.14})`;
      ctx.beginPath(); ctx.arc(x, y, s*0.75 + pulse*4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='#0a2a3a';
      ctx.fillRect(x - s/2, y - s/2 +2, s, s-4);
      ctx.fillStyle='#00aaff';
      ctx.fillRect(x - s/2 +2, y - s/2 +2, s-4, 3);
      ctx.fillStyle='#e0ffff';
      ctx.fillRect(x-3, y-6, 6, 12);
      ctx.fillStyle='#ffffff';
      ctx.fillRect(x-2, y-5, 4, 2);
      ctx.fillRect(x, y-3, 4, 2);
      ctx.fillRect(x-3, y-1, 4, 2);
      ctx.fillRect(x, y+1, 4, 2);
      ctx.fillRect(x-2, y+3, 4, 2);
      ctx.fillStyle='#ffcc00';
      ctx.font='5px "Press Start 2P"'; ctx.textAlign='center';
      ctx.fillText('RAIO', x, y+ s/2 +10); ctx.textAlign='left';
      ctx.fillStyle=`rgba(255,255,255,${0.7+Math.sin(this.anim*5)*0.3})`;
      const rx = x + Math.cos(this.anim*1.7)* (s*0.6);
      const ry = y + Math.sin(this.anim*1.7)* (s*0.4);
      ctx.fillRect(rx, ry, 2, 2);
      const rx2 = x + Math.cos(this.anim*1.7+2)* (s*0.5);
      const ry2 = y + Math.sin(this.anim*1.7+2)* (s*0.5);
      ctx.fillStyle='rgba(0,229,255,0.9)'; ctx.fillRect(rx2, ry2, 2, 2);
    } else if(this.isMini){
      const x=this.x, y=this.y + this.bob, s=this.w;
      const pulse = 0.5 + Math.sin(this.anim*2.6)*0.33;
      ctx.fillStyle='rgba(0,0,0,0.28)';
      ctx.beginPath(); ctx.ellipse(x, y+ s*0.5, s*0.5, 4, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle=`rgba(255,59,48,${0.22+pulse*0.14})`;
      ctx.beginPath(); ctx.arc(x, y, s*0.75 + pulse*4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='#1a0a0f';
      ctx.fillRect(x - s/2, y - s/2 +2, s, s-4);
      ctx.fillStyle='#4a1a1a';
      ctx.fillRect(x - s/2 +2, y - s/2 +2, s-4, 3);
      // corpo metralhadora
      ctx.fillStyle='#2a2a2a';
      ctx.fillRect(x - s/2 +2, y -3, s-4, 8);
      ctx.fillStyle='#ff3b30';
      ctx.fillRect(x - s/2 +2, y -1, s-4, 2);
      ctx.fillStyle='#ffcc00';
      // canos múltiplos
      ctx.fillRect(x -6, y-5, 2, 10);
      ctx.fillRect(x -2, y-5, 2, 10);
      ctx.fillRect(x +2, y-5, 2, 10);
      ctx.fillStyle='#ffcc00';
      ctx.font='4px "Press Start 2P"'; ctx.textAlign='center';
      ctx.fillText('MG', x, y+ s/2 +10); ctx.textAlign='left';
      ctx.fillStyle=`rgba(255,255,255,${0.6+Math.sin(this.anim*6)*0.3})`;
      const rx = x + Math.cos(this.anim*1.4)* (s*0.5);
      const ry = y + Math.sin(this.anim*1.4)* (s*0.3);
      ctx.fillRect(rx, ry, 2,1);
    } else if(this.isNormal){
      const x=this.x, y=this.y + this.bob, s=this.w;
      const pulse = 0.5 + Math.sin(this.anim*2)*0.28;
      ctx.fillStyle='rgba(0,0,0,0.28)';
      ctx.beginPath(); ctx.ellipse(x, y+ s*0.5, s*0.5, 4, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle=`rgba(90,143,212,${0.18+pulse*0.1})`;
      ctx.beginPath(); ctx.arc(x, y, s*0.65 + pulse*2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='#1a2a4a';
      ctx.fillRect(x - s/2 +2, y -4, s-4, 10);
      ctx.fillStyle='#5a8fd4';
      ctx.fillRect(x -4, y-1, 8, 3);
      ctx.fillStyle='#ffeb3b';
      ctx.fillRect(x -3, y, 6,1);
      ctx.fillStyle='#ffcc00';
      ctx.font='4px "Press Start 2P"'; ctx.textAlign='center';
      ctx.fillText('PIST', x, y+ s/2 +10); ctx.textAlign='left';
    } else if(this.isCarregada){
      const x=this.x, y=this.y + this.bob, s=this.w;
      const pulse = 0.5 + Math.sin(this.anim*2.4)*0.32;
      ctx.fillStyle='rgba(0,0,0,0.28)';
      ctx.beginPath(); ctx.ellipse(x, y+ s*0.5, s*0.5, 4, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle=`rgba(167,139,250,${0.20+pulse*0.14})`;
      ctx.beginPath(); ctx.arc(x, y, s*0.7 + pulse*3, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='#1e103a';
      ctx.fillRect(x - s/2 +2, y -5, s-4, 12);
      ctx.fillStyle='#7c3aed';
      ctx.fillRect(x - s/2 +2, y -1, s-4, 4);
      // indicador carga
      ctx.fillStyle='#a78bfa';
      ctx.fillRect(x -5, y-6, 2, 8);
      ctx.fillRect(x +4, y-6, 2, 8);
      ctx.fillStyle='#e9d5ff';
      ctx.fillRect(x -4, y-3, 3, 1);
      ctx.fillRect(x +2, y-3, 3, 1);
      // núcleo brilhante pulsante
      ctx.fillStyle=`rgba(216,180,254,${0.6+pulse*0.35})`;
      ctx.fillRect(x-2, y-1, 4, 2);
      ctx.fillStyle='#ffcc00';
      ctx.font='4px "Press Start 2P"'; ctx.textAlign='center';
      ctx.fillText('CARG', x, y+ s/2 +10); ctx.textAlign='left';
      ctx.fillStyle=`rgba(255,255,255,${0.55+Math.sin(this.anim*5)*0.3})`;
      const rx = x + Math.cos(this.anim*1.6)* (s*0.45);
      const ry = y + Math.sin(this.anim*1.6)* (s*0.3);
      ctx.fillRect(rx, ry, 2, 1);
    } else if(this.isBazuca){
      const x=this.x, y=this.y + this.bob, s=this.w;
      const pulse = 0.5 + Math.sin(this.anim*2.3)*0.33;
      ctx.fillStyle='rgba(0,0,0,0.28)';
      ctx.beginPath(); ctx.ellipse(x, y+ s*0.5, s*0.5, 4, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle=`rgba(255,59,48,${0.22+pulse*0.14})`;
      ctx.beginPath(); ctx.arc(x, y, s*0.75 + pulse*4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='#1a0a0a';
      ctx.fillRect(x - s/2, y - s/2 +2, s, s-4);
      ctx.fillStyle='#2a2a2e';
      ctx.fillRect(x - s/2 +2, y - s/2 +2, s-4, 3);
      // corpo bazuca
      ctx.fillStyle='#3a3a3a';
      ctx.fillRect(x - s/2 +2, y -2, s-4, 8);
      ctx.fillStyle='#ff3b30';
      ctx.fillRect(x - s/2 +4, y, s-8, 2);
      ctx.fillStyle='#ffcc00';
      ctx.fillRect(x + s/2 -6, y -3, 2, 6); // mira
      ctx.fillStyle='#555';
      ctx.fillRect(x -6, y -1, 10, 2);
      ctx.fillStyle='#ffcc00';
      ctx.font='4px "Press Start 2P"'; ctx.textAlign='center';
      ctx.fillText('BZ', x, y+ s/2 +10); ctx.textAlign='left';
      ctx.fillStyle=`rgba(255,255,255,${0.6+Math.sin(this.anim*4)*0.3})`;
      const rbx = x + Math.cos(this.anim*1.6)* (s*0.45);
      ctx.fillRect(rbx, y-4, 3, 2);
    } else if(this.isEspada){
      const x=this.x, y=this.y + this.bob, s=this.w;
      const pulse=0.5+Math.sin(this.anim*2.5)*0.32;
      ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(x, y+s*0.5, s*0.5, 4,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=`rgba(220,220,230,${0.18+pulse*0.12})`; ctx.beginPath(); ctx.arc(x,y,s*0.72+pulse*3,0,Math.PI*2); ctx.fill();
      // bainha/base
      ctx.fillStyle='#2a2a2e'; ctx.fillRect(x - s/2+2, y-6, s-4, 14);
      ctx.fillStyle='#3a3a4a'; ctx.fillRect(x - s/2+3, y-5, s-6, 2);
      // lâmina metálica
      ctx.fillStyle='#e8e8e8'; ctx.fillRect(x-1, y-8, 2, 14);
      ctx.fillStyle='#ffffff'; ctx.fillRect(x-0.5, y-7, 1, 10);
      ctx.fillStyle='#a0a0b8'; ctx.fillRect(x-1, y+5, 2, 2);
      // guarda
      ctx.fillStyle='#c0a030'; ctx.fillRect(x-6, y-2, 12, 2);
      ctx.fillStyle='#8a6d3b'; ctx.fillRect(x-5, y-1, 10, 1);
      // cabo
      ctx.fillStyle='#6b3f1d'; ctx.fillRect(x-2, y+2, 4, 6);
      ctx.fillStyle='#3a1a0a'; ctx.fillRect(x-1, y+7, 2, 2);
      // brilho
      ctx.fillStyle=`rgba(255,255,255,${0.55+pulse*0.25})`; ctx.fillRect(x+2, y-5, 1, 6);
      ctx.fillStyle='#ffcc00'; ctx.font='4px "Press Start 2P"'; ctx.textAlign='center'; ctx.fillText('ESP', x, y+s/2+10); ctx.textAlign='left';
    } else if(this.isLuva){
      const x=this.x, y=this.y + this.bob, s=this.w;
      const pulse=0.5+Math.sin(this.anim*2.4)*0.34;
      ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(x, y+s*0.5, s*0.5, 4,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=`rgba(255,60,60,${0.20+pulse*0.13})`; ctx.beginPath(); ctx.arc(x,y,s*0.78+pulse*4,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#1a0a0a'; ctx.fillRect(x - s/2+1, y-5, s-2, 12);
      // DUAL: 2 luvas lado a lado
      ctx.fillStyle='#ff3b30'; ctx.beginPath(); ctx.arc(x-5, y-1, 5.8,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#ff6b6b'; ctx.beginPath(); ctx.arc(x-5, y-1, 3.6,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#ff3b30'; ctx.beginPath(); ctx.arc(x+5, y-1, 5.8,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#ff6b6b'; ctx.beginPath(); ctx.arc(x+5, y-1, 3.6,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#1a1a1a'; ctx.fillRect(x+2, y-2, 4, 4);
      ctx.fillStyle='#ffcc00'; ctx.fillRect(x+3, y-1, 2,1);
      ctx.fillStyle='#1a1a1a'; ctx.fillRect(x-6, y-2, 4, 4);
      ctx.fillStyle='#ffcc00'; ctx.fillRect(x-5, y-1, 2,1);
      // foguetes atrás
      ctx.fillStyle='#5a3a00'; ctx.fillRect(x-10, y-1, 3, 4);
      ctx.fillStyle='#5a3a00'; ctx.fillRect(x+7, y-1, 3, 4);
      ctx.fillStyle='rgba(255,120,40,0.88)'; ctx.fillRect(x-11, y, 2,2);
      ctx.fillStyle='rgba(255,120,40,0.88)'; ctx.fillRect(x+9, y, 2,2);
      ctx.fillStyle='#ffcc00'; ctx.font='4px "Press Start 2P"'; ctx.textAlign='center'; ctx.fillText('LUVA', x, y+s/2+10); ctx.textAlign='left';
      // ícone de luva de boxe central - grande e visível com contorno
      ctx.fillStyle='#fff';
      ctx.font='16px sans-serif'; ctx.textAlign='center';
      // sombra para destacar emoji
      ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillText('🥊', x+1, y+5);
      ctx.fillStyle='#fff'; ctx.fillText('🥊', x, y+4); ctx.textAlign='left';
      ctx.fillStyle=`rgba(255,255,255,${0.6+Math.sin(this.anim*5)*0.3})`; const rlx=x+Math.cos(this.anim*1.6)*5; ctx.fillRect(rlx, y-6, 2,1.5);
    } else if(this.isBastao){
      const x=this.x, y=this.y + this.bob, s=this.w;
      const pulse=0.5+Math.sin(this.anim*2.4)*0.34;
      ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(x, y+s*0.5, s*0.5, 4,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=`rgba(250,204,21,${0.20+pulse*0.13})`; ctx.beginPath(); ctx.arc(x,y,s*0.78+pulse*4,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#1a1500'; ctx.fillRect(x - s/2+1, y-5, s-2, 12);
      ctx.fillStyle='#facc15'; ctx.fillRect(x - s/2+3, y-3, s-6, 6);
      ctx.fillStyle='#fffbeb'; ctx.fillRect(x - s/2+5, y-1, s-10, 2);
      ctx.fillStyle='#3a2e00'; ctx.fillRect(x - s/2+1, y-5, 3, 12);
      ctx.fillRect(x + s/2-4, y-5, 3, 12);
      // giro hint
      ctx.strokeStyle=`rgba(250,204,21,${0.45+pulse*0.2})`; ctx.lineWidth=1.2; ctx.beginPath(); ctx.arc(x,y,s*0.32, this.anim, this.anim+4.2); ctx.stroke();
      ctx.fillStyle='#ffcc00'; ctx.font='4px "Press Start 2P"'; ctx.textAlign='center'; ctx.fillText('BASTAO', x, y+s/2+10); ctx.textAlign='left';
      ctx.fillStyle=`rgba(255,255,255,${0.6+Math.sin(this.anim*5)*0.3})`; const rbx=x+Math.cos(this.anim*1.6)*5; ctx.fillRect(rbx, y-6, 2,1.5);
    } else if(this.isMotosserra){
      const x=this.x, y=this.y+this.bob, s=this.w;
      const pulse=0.5+Math.sin(this.anim*2.4)*0.34;
      ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(x, y+s*0.5, s*0.5, 4,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=`rgba(255,60,60,${0.22+pulse*0.14})`; ctx.beginPath(); ctx.arc(x,y,s*0.78+pulse*4,0,Math.PI*2); ctx.fill();
      // base motosserra
      ctx.fillStyle='#1a0a0a'; ctx.fillRect(x - s/2+2, y-5, s-4, 12);
      ctx.fillStyle='#2a2a2e'; ctx.fillRect(x - s/2+2, y-3, s-4, 8);
      ctx.fillStyle='#ff3b30'; ctx.fillRect(x - s/2+3, y-2, s-6, 4);
      ctx.fillStyle='#3a1a0a'; ctx.fillRect(x - s/2+6, y-1, s-10, 2);
      // serra central girando
      const spin=this.anim*0.22;
      ctx.save(); ctx.translate(x, y);
      ctx.rotate(spin);
      ctx.fillStyle='#e8e8e8'; ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#ff3b30'; ctx.lineWidth=1.2;
      for(let i=0;i<6;i++){ const ang=(i/6)*Math.PI*2; ctx.beginPath(); ctx.moveTo(Math.cos(ang)*3, Math.sin(ang)*3); ctx.lineTo(Math.cos(ang)*6, Math.sin(ang)*6); ctx.stroke(); }
      ctx.fillStyle='#1a1a1a'; ctx.beginPath(); ctx.arc(0,0,2,0,Math.PI*2); ctx.fill();
      ctx.restore();
      // dentes estáticos laterais
      ctx.fillStyle='#a0a0a0'; ctx.fillRect(x-4, y-3, 8,1); ctx.fillRect(x-4, y+1, 8,1);
      ctx.fillStyle='#ffcc00'; ctx.font='4px "Press Start 2P"'; ctx.textAlign='center'; ctx.fillText('SERRA', x, y+s/2+10); ctx.textAlign='left';
      ctx.fillStyle=`rgba(255,255,255,${0.6+Math.sin(this.anim*5)*0.3})`; const rmx=x+Math.cos(this.anim*1.6)*5; ctx.fillRect(rmx, y-6, 2,1.5);
      // indicador Pochita se very rare (mostra no chão como preview)
      ctx.fillStyle='rgba(255,180,60,0.42)'; ctx.font='6px monospace'; ctx.textAlign='center'; ctx.fillText('◉', x+6, y-7); ctx.textAlign='left';
    } else if(this.isRayMatematico){
      // Azazel Brimstone Azul - ícone no chão (horizontal beam com chifres)
      const x=this.x, y=this.y + this.bob, s=this.w;
      const pulse=0.5+Math.sin(this.anim*2.2)*0.33;
      ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(x, y+s*0.5, s*0.5, 4,0,0,Math.PI*2); ctx.fill();
      // glow externo azul demoníaco
      ctx.fillStyle=`rgba(26,127,191,${0.18+pulse*0.10})`; ctx.beginPath(); ctx.arc(x,y,s*0.80+pulse*3,0,Math.PI*2); ctx.fill();
      // base retangular escura (recipiente)
      ctx.fillStyle='#041226'; ctx.fillRect(x - s/2+1, y-7, s-2, 14);
      ctx.fillStyle='#0a2a4a'; ctx.fillRect(x - s/2+2, y-6, s-4, 12);
      // feixe Azazel horizontal - camadas Brimstone azul
      // outer dark
      ctx.fillStyle='#081e3a'; ctx.fillRect(x - s/2+2, y-4, s-4, 8);
      // mid blue
      ctx.fillStyle='#1a5fb8'; ctx.fillRect(x - s/2+3, y-3, s-6, 6);
      // inner ciano
      ctx.fillStyle='#3aa0ff'; ctx.fillRect(x - s/2+4, y-2, s-8, 4);
      // núcleo branco-azulado
      ctx.fillStyle='#b8fffb'; ctx.fillRect(x - s/2+5, y-1, s-10, 2);
      ctx.fillStyle='#ffffff'; ctx.fillRect(x -2, y-1, 4, 2);
      // ondulação sutil
      if(Math.floor(this.anim*3)%2===0){
        ctx.fillStyle='rgba(255,255,255,0.55)'; ctx.fillRect(x+2, y-2, 1, 1);
      }
      // chifres Azazel mini nos cantos (sugestão demoníaca)
      ctx.fillStyle='#1a1a1a'; ctx.fillRect(x - s/2+2, y-7, 2, 3); ctx.fillRect(x + s/2-4, y-7, 2, 3);
      ctx.fillStyle='#3a3a3a'; ctx.fillRect(x - s/2+2.5, y-6.5, 1, 1.5); ctx.fillRect(x + s/2-3.5, y-6.5, 1, 1.5);
      // texto - LAZER CODIFICADO Brimstone
      ctx.fillStyle='#7af2ff'; ctx.font='4px "Press Start 2P"'; ctx.textAlign='center'; ctx.fillText('LAZER', x, y+s/2+10); ctx.textAlign='left';
      ctx.fillStyle=`rgba(255,255,255,${0.6+Math.sin(this.anim*5)*0.3})`; const rrx=x+Math.cos(this.anim*1.6)*5; ctx.fillRect(rrx, y-6, 2,1.5);
    } else if(this.isMartelo){ /* removido */
    } else if(this.isLanca){ /* removido */
    } else if(this.isArco){ /* removido */
    } else if(this.isMachado){ /* removido */
    } else {
      const x=this.x, y=this.y + this.bob;
      const s=this.w;
      ctx.fillStyle='rgba(0,0,0,0.28)';
      ctx.beginPath(); ctx.ellipse(x, y+ s*0.5, s*0.5, 4, 0, 0, Math.PI*2); ctx.fill();
      const pulse = 0.5 + Math.sin(this.anim*2.2)*0.3;
      ctx.fillStyle=`rgba(255,140,66,${0.20+pulse*0.12})`;
      ctx.beginPath(); ctx.arc(x, y, s*0.7 + pulse*3, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='#2a1a0f';
      ctx.fillRect(x - s/2, y - s/2 +2, s, s-4);
      ctx.fillStyle='#6b4a2d';
      ctx.fillRect(x - s/2 +2, y - s/2 +2, s-4, 3);
      ctx.fillStyle='#1a1a1a';
      ctx.fillRect(x - s/2 +3, y -4, s-6, 4);
      ctx.fillRect(x - s/2 +3, y+2, s-6, 3);
      ctx.fillStyle='#8b5a2b';
      ctx.fillRect(x -5, y+4, 10, 5);
      ctx.fillStyle='rgba(255,255,255,0.9)';
      ctx.fillRect(x - s/2 +5, y -3, 6, 1);
      ctx.fillStyle='#ffcc00';
      ctx.font='5px "Press Start 2P"'; ctx.textAlign='center';
      ctx.fillText('SG', x, y+ s/2 +10); ctx.textAlign='left';
      ctx.fillStyle=`rgba(255,204,0,${0.6+Math.sin(this.anim*4)*0.3})`;
      const rx = x + Math.cos(this.anim*1.5)* (s*0.55);
      const ry = y + Math.sin(this.anim*1.5)* (s*0.35);
      ctx.fillRect(rx, ry, 2, 2);
    }
    }catch(e){ console.error('WeaponItem draw error', this.weaponType, e); try{ // fallback genérico
      const x=this.x, y=this.y+this.bob, s=this.w;
      ctx.fillStyle='rgba(255,140,66,0.22)'; ctx.beginPath(); ctx.arc(x,y,s*0.6,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#2a1a0f'; ctx.fillRect(x-s/2,y-s/2+2,s,s-4);
      ctx.fillStyle='#ffcc00'; ctx.font='4px "Press Start 2P"'; ctx.textAlign='center'; ctx.fillText('ITEM',x,y+s/2+10); ctx.textAlign='left';
    }catch(_){}
    }
  }
}

// ===================== UPGRADE ITEM (Melhorias de Arma) =====================
// Integrado ao sistema de itens existente, reutiliza Item, mostra raridade com cores distintas
class UpgradeItem extends Item {
  constructor(x, y, upgradeId){
    const def = UPGRADE_MAP.get(upgradeId);
    const rarity = def ? RARITY[def.rarity] : RARITY.COMUM;
    super(x, y, 20, 20, 'upgrade_'+upgradeId);
    this.upgradeId = upgradeId;
    this.def = def;
    this.rarity = rarity;
    // tipo para identificação rápida
    this.isUpgrade = true;
  }
  onCollect(player){
    // verifica se pode adicionar (nível < max e compatível)
    if(!player.canAddUpgrade(this.upgradeId)) return false;
    const ok = player.addUpgrade(this.upgradeId);
    return ok;
  }
  draw(ctx){
    const x=this.x, y=this.y + this.bob, s=this.w;
    const pulse = 0.5 + Math.sin(this.anim*2.6)*0.32;
    const r = this.rarity;
    const def = this.def;
    // sombra
    ctx.fillStyle='rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(x, y+ s*0.45, s*0.5, 4, 0, 0, Math.PI*2); ctx.fill();
    // glow raridade
    ctx.fillStyle = r.glow;
    ctx.beginPath(); ctx.arc(x, y, s*0.75 + pulse*4, 0, Math.PI*2); ctx.fill();
    // fundo
    ctx.fillStyle='#0f0f1e';
    ctx.fillRect(x - s/2, y - s/2 +2, s, s-4);
    // borda com cor raridade
    ctx.strokeStyle = r.border;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - s/2, y - s/2 +2, s, s-4);
    // faixa superior com cor raridade (indica raridade)
    ctx.fillStyle = r.color;
    ctx.fillRect(x - s/2 +1, y - s/2 +2, s-2, 3);
    // ícone arma (mini) - suporta compatível ALL
    let weaponColor = '#a78bfa';
    if(def.weapon==='NORMAL') weaponColor='#ffeb3b';
    else if(def.weapon==='SHOTGUN') weaponColor='#ff8c42';
    else if(def.weapon==='RAIO') weaponColor='#00e5ff';
    else if(def.weapon==='RAIO_MATEMATICO') weaponColor='#7af2ff';
    else if(def.weapon==='METRALHADORA') weaponColor='#ff3b30';
    else if(def.weapon==='CARREGADA') weaponColor='#c084fc';
    else if(def.weapon==='ALL') weaponColor='#ffd700';
    else if(def.compatible && def.compatible.includes('ALL')) weaponColor='#ffd700';
    ctx.fillStyle = weaponColor;
    if(def.weapon==='SHOTGUN' || (def.compatible && def.compatible.includes('SHOTGUN'))){
      ctx.fillRect(x-5, y-1, 10, 2); ctx.fillRect(x-4, y+2, 8,1);
    } else if(def.weapon==='RAIO'){
      ctx.fillRect(x-4, y-2, 8, 3); ctx.fillStyle='#fff'; ctx.fillRect(x-1, y-1, 2,1);
    } else if(def.weapon==='RAIO_MATEMATICO'){
      ctx.fillRect(x-4, y-2, 8, 3); ctx.fillStyle='#b8fffb'; ctx.fillRect(x-3, y-1, 6,1); ctx.fillStyle='#fff'; ctx.font='4px monospace'; ctx.textAlign='center'; ctx.fillText('∑', x, y+2); ctx.textAlign='left';
    } else if(def.weapon==='METRALHADORA'){
      ctx.fillRect(x-5, y-1, 10,2); ctx.fillRect(x-3, y+1, 6,1);
    } else if(def.weapon==='CARREGADA'){
      ctx.fillRect(x-4, y-1, 8,2); ctx.fillStyle='#fff'; ctx.fillRect(x-1, y, 2,1);
    } else if(def.weapon==='ALL'){
      // ícone genérico para ALL
      ctx.fillRect(x-5, y-2, 10, 2); ctx.fillRect(x-5, y+1, 10, 1);
      ctx.fillStyle='#fff'; ctx.fillRect(x-1, y-1, 2,2);
    } else {
      ctx.fillRect(x-4, y-1, 8,2); ctx.fillStyle='#fff'; ctx.fillRect(x-1, y-1, 2,1);
    }
    // estrelas raridade (1-4)
    const stars = r.id==='COMUM'?1 : r.id==='INCOMUM'?2 : r.id==='RARA'?3 : 4;
    ctx.fillStyle = r.id==='MUITO_RARA' ? r.gold : r.color;
    ctx.font='4px monospace'; ctx.textAlign='center';
    let starStr=''; for(let i=0;i<stars;i++) starStr+='★';
    ctx.fillText(starStr, x, y+ s/2 +9);
    // nível (se tiver maxLevel)
    if(def.maxLevel && def.maxLevel>1){
      const curLv = (typeof window!=='undefined' && window.game && window.game.player) ? (window.game.player.upgradeLevels.get(def.id)||0) + 1 : 1;
      const maxLv = def.maxLevel;
      ctx.fillStyle='rgba(255,255,255,0.85)';
      ctx.font='3px "Press Start 2P"';
      ctx.fillText(`Nv${curLv}/${maxLv}`, x, y+ s/2 +13);
      // pontos de nível
      for(let i=0;i<maxLv;i++){
        ctx.fillStyle = i < curLv ? r.color : 'rgba(255,255,255,0.18)';
        ctx.fillRect(x - (maxLv*3) + i*6, y+ s/2 +15, 4, 1);
      }
    }
    ctx.textAlign='left';
    // brilho pulsante para muito rara
    if(r.id==='MUITO_RARA'){
      ctx.fillStyle=`rgba(255,215,0,${0.35+pulse*0.25})`;
      ctx.beginPath(); ctx.arc(x, y, s*0.55 + pulse*2, 0, Math.PI*2); ctx.stroke();
      if(Math.random()<0.12){
        ctx.fillStyle='rgba(255,255,255,0.9)';
        ctx.fillRect(x+randRange(-6,6), y+randRange(-5,4), 1,1);
      }
    }
    // compatível (pequeno)
    if(def.compatible){
      ctx.fillStyle='rgba(255,255,255,0.55)';
      ctx.font='3px monospace'; ctx.textAlign='center';
      const compatStr = def.compatible.includes('ALL') ? 'TODAS' : def.compatible.map(w=>w.substring(0,3)).join(',');
      ctx.fillText(compatStr, x, y - s/2 -4);
      ctx.textAlign='left';
    } else {
      ctx.fillStyle='rgba(255,255,255,0.55)';
      ctx.font='3px monospace'; ctx.textAlign='center';
      const shortW = def.weapon==='NORMAL'?'NML': def.weapon==='SHOTGUN'?'SHT': def.weapon==='RAIO'?'RAI': def.weapon==='METRALHADORA'?'MTR': def.weapon==='CARREGADA'?'CRG': def.weapon==='ALL'?'ALL':'???';
      ctx.fillText(shortW, x, y - s/2 -4);
      ctx.textAlign='left';
    }
  }
}

// Item passivo raro: Rastro de Fogo - dash deixa fogo no chão
class FlameTrailItem extends Item {
  constructor(x, y){
    super(x, y, ITEM_SIZE_FLAME, ITEM_SIZE_FLAME, 'flame_trail');
  }
  onCollect(player){
    if(player.hasFlameTrail) return false;
    player.enableFlameTrail();
    return true;
  }
  draw(ctx){
    const x=this.x, y=this.y + this.bob, s=this.w;
    const pulse = 0.5 + Math.sin(this.anim*2.6)*0.35;
    ctx.fillStyle='rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(x, y+ s*0.45, s*0.5, 4, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle=`rgba(255,70,0,${0.22+pulse*0.14})`;
    ctx.beginPath(); ctx.arc(x, y, s*0.75 + pulse*3, 0, Math.PI*2); ctx.fill();
    // frasco / bota flamejante
    ctx.fillStyle='#3a1a00';
    ctx.fillRect(x - s/2 +3, y - s/2 +2, s-6, s-4);
    ctx.fillStyle='#ff6a00';
    ctx.fillRect(x - s/2 +4, y - s/2 +4, s-8, 4);
    // chama
    ctx.fillStyle='#ff3b00';
    ctx.beginPath();
    ctx.moveTo(x, y-6);
    ctx.lineTo(x-4, y+2);
    ctx.lineTo(x-2, y+1);
    ctx.lineTo(x, y+4);
    ctx.lineTo(x+2, y+1);
    ctx.lineTo(x+4, y+2);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle='#ffcc00';
    ctx.beginPath();
    ctx.moveTo(x, y-3);
    ctx.lineTo(x-2, y+1);
    ctx.lineTo(x, y+2);
    ctx.lineTo(x+2, y+1);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle='#ffffff';
    ctx.beginPath(); ctx.arc(x, y-1, 1.2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='#ffcc00';
    ctx.font='4px "Press Start 2P"'; ctx.textAlign='center';
    ctx.fillText('FOGO', x, y+ s/2 +9); ctx.textAlign='left';
    // partícula flamejante
    if(Math.random()<0.18){
      ctx.fillStyle='rgba(255,140,0,0.9)';
      ctx.fillRect(x+randRange(-5,5), y+randRange(-6,3), 2,2);
    }
  }
}

// Segundo item novo: Botas Velozes - aumento passivo de velocidade e dash
class SwiftBootsItem extends Item {
  constructor(x, y){
    super(x, y, 20, 20, 'swift_boots');
  }
  onCollect(player){
    if(player._hasSwiftBoots) return false;
    player.speed += 0.75;
    player._hasSwiftBoots = true;
    return true;
  }
  draw(ctx){
    const x=this.x, y=this.y + this.bob, s=this.w;
    const pulse = 0.5 + Math.sin(this.anim*2.4)*0.3;
    ctx.fillStyle='rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(x, y+ s*0.45, s*0.5, 4, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle=`rgba(0,217,255,${0.18+pulse*0.12})`;
    ctx.beginPath(); ctx.arc(x, y, s*0.7 + pulse*3, 0, Math.PI*2); ctx.fill();
    // bota
    ctx.fillStyle='#1a2a3a';
    ctx.fillRect(x - s/2 +2, y -4, s-4, 10);
    ctx.fillStyle='#00d9ff';
    ctx.fillRect(x - s/2 +2, y+4, s-4, 3);
    ctx.fillStyle='#ffffff';
    ctx.fillRect(x -3, y-2, 6, 1);
    ctx.fillStyle='#ffcc00';
    ctx.font='4px "Press Start 2P"'; ctx.textAlign='center';
    ctx.fillText('VENTO', x, y+ s/2 +9); ctx.textAlign='left';
    // brilho vento
    ctx.fillStyle=`rgba(255,255,255,${0.6+Math.sin(this.anim*5)*0.3})`;
    const rx = x - s/2 + 4 + Math.sin(this.anim*3)*3;
    ctx.fillRect(rx, y-6, 4, 1);
  }
}

// Melhoria arma principal: Tiro Duplo - dispara dois projéteis lado a lado
class DoubleShotItem extends Item {
  constructor(x,y){
    super(x,y, 20, 20, 'double_shot');
  }
  onCollect(player){
    if(player.hasDoubleShot) return false;
    player.enableDoubleShot();
    return true;
  }
  draw(ctx){
    const x=this.x, y=this.y + this.bob, s=this.w;
    const pulse = 0.5 + Math.sin(this.anim*2.5)*0.32;
    ctx.fillStyle='rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(x, y+ s*0.45, s*0.5, 4, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle=`rgba(90,143,212,${0.18+pulse*0.12})`;
    ctx.beginPath(); ctx.arc(x, y, s*0.7 + pulse*3, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='#1a2a4a';
    ctx.fillRect(x - s/2 +2, y -5, s-4, 10);
    ctx.fillStyle='#5a8fd4';
    // dois canos lado a lado
    ctx.fillRect(x -5, y-1, 5, 3);
    ctx.fillRect(x +1, y-1, 5, 3);
    ctx.fillStyle='#ffeb3b';
    ctx.fillRect(x -4, y, 3,1);
    ctx.fillRect(x +2, y, 3,1);
    ctx.fillStyle='#ffcc00';
    ctx.font='4px "Press Start 2P"'; ctx.textAlign='center';
    ctx.fillText('x2', x, y+ s/2 +9); ctx.textAlign='left';
    ctx.fillStyle=`rgba(255,255,255,${0.5+Math.sin(this.anim*5)*0.3})`;
    ctx.fillRect(x-2, y-7, 4,1);
  }
}

// ===================== PICKUP ITEM ESPECIAL (E) =====================
// Item no chão que equipa um SpecialItem ao coletar.
// Separado de WeaponItem para não misturar lógica de tiro com habilidade especial.
// Uso: new SpecialItemPickup(x,y,'espada_flamejante') ou 'escudo_magico'
class SpecialItemPickup extends Item {
  constructor(x, y, specialId){
    super(x, y, 20, 20, 'special_'+specialId);
    this.specialId = specialId;
    // Guarda config visual sem instanciar habilidade (evita custo)
    const factory = SPECIAL_REGISTRY[specialId];
    const tmp = factory ? factory() : null;
    this.specialName = tmp ? tmp.name : specialId;
    this.specialIcon = tmp ? tmp.icon : '★';
    this.specialColor = tmp ? tmp.color : '#ffcc00';
    this.isSpecialPickup = true;
  }
  onCollect(player){
    // Coleta automática DESATIVADA para especiais: troca/pegada é exclusivamente via tecla E (requisito).
    // Retorna false para não remover automaticamente ao encostar, evitando duplicação e abuso.
    // A lógica de E está em Game.trySpecialSwapOrPickup() que verifica distância e spawnDelay.
    return false;
  }
  // Método chamado exclusivamente por Game via E (com validação de distância/spawnDelay)
  tryPickupViaE(player){
    const newSpecial = createSpecialItem(this.specialId);
    if(!newSpecial) return false;
    // Mesmo item já equipado: não troca (poderia permitir, mas evita spam/loop)
    if(player.equippedSpecial && player.equippedSpecial.id === this.specialId) return false;
    player.equipSpecial(newSpecial);
    return true;
  }
  // Atualiza propriedades visuais quando este objeto é reutilizado para o item antigo no chão (troca)
  updateForSwap(newSpecialId){
    this.specialId = newSpecialId;
    const factory = SPECIAL_REGISTRY[newSpecialId];
    const tmp = factory ? factory() : null;
    this.specialName = tmp ? tmp.name : newSpecialId;
    this.specialIcon = tmp ? tmp.icon : '★';
    this.specialColor = tmp ? tmp.color : '#ffcc00';
    this.type = 'special_'+newSpecialId;
    // spawnDelay evita re-pega instantânea (anti-duplicação/exploit)
    this.spawnDelay = 360;
  }
  draw(ctx){
    const x=this.x, y=this.y + this.bob, s=this.w;
    const pulse = 0.5 + Math.sin(this.anim*2.4)*0.32;
    const col = this.specialColor;
    // sombra
    ctx.fillStyle='rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(x, y+ s*0.45, s*0.5, 4, 0, 0, Math.PI*2); ctx.fill();
    // glow colorido - corrigido para hex e emoji, cada especial com cor própria
    if(this.specialId==='espada_flamejante') ctx.fillStyle=`rgba(255,106,0,${0.22+pulse*0.14})`;
    else if(this.specialId==='escudo_magico') ctx.fillStyle=`rgba(0,229,255,${0.22+pulse*0.14})`;
    else if(this.specialId==='flecha_stand') ctx.fillStyle=`rgba(192,132,252,${0.22+pulse*0.14})`;
    else if(this.specialId==='gato_antivirus') ctx.fillStyle=`rgba(59,130,246,${0.26+pulse*0.16})`;
    else if(this.specialId==='power_star') ctx.fillStyle=`rgba(255,215,0,${0.28+pulse*0.16})`;
    else if(this.specialId==='farmar_aura') ctx.fillStyle=`rgba(255,107,157,${0.26+pulse*0.16})`;
    else {
      // fallback hex -> rgba via helper
      if(col.startsWith('#')){
        const hex=col.replace('#','');
        const r=parseInt(hex.substr(0,2),16), g=parseInt(hex.substr(2,2),16), b=parseInt(hex.substr(4,2),16);
        ctx.fillStyle=`rgba(${r},${g},${b},${0.22+pulse*0.12})`;
      } else {
        ctx.fillStyle = col.replace(')', `,${0.22+pulse*0.12})`).replace('rgb','rgba');
      }
    }
    ctx.beginPath(); ctx.arc(x, y, s*0.7 + pulse*4, 0, Math.PI*2); ctx.fill();
    // fundo
    ctx.fillStyle='#0f0f1e';
    ctx.fillRect(x - s/2, y - s/2 +2, s, s-4);
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - s/2, y - s/2 +2, s, s-4);
    // faixa superior
    ctx.fillStyle = col;
    ctx.fillRect(x - s/2 +1, y - s/2 +2, s-2, 3);
    // ícone central grande - corrigido alinhamento e fonte para emojis vs 67
    ctx.fillStyle='#fff';
    ctx.textAlign='center';
    if(this.specialId==='farmar_aura'){
      ctx.font='bold 13px "Press Start 2P"';
      ctx.fillText(this.specialIcon, x, y+5);
    } else if(this.specialId==='escudo_magico'){
      ctx.font='14px sans-serif';
      ctx.fillText(this.specialIcon, x, y+5);
    } else if(this.specialId==='espada_flamejante'){
      ctx.font='14px sans-serif';
      ctx.fillText(this.specialIcon, x, y+5);
    } else if(this.specialId==='flecha_stand'){
      ctx.font='14px sans-serif';
      ctx.fillText(this.specialIcon, x, y+5);
    } else if(this.specialId==='gato_antivirus'){
      ctx.font='14px sans-serif';
      ctx.fillText(this.specialIcon, x, y+5);
    } else if(this.specialId==='power_star'){
      ctx.font='14px sans-serif';
      ctx.fillText(this.specialIcon, x, y+5);
    } else {
      ctx.font='12px sans-serif';
      ctx.fillText(this.specialIcon, x, y+4);
    }
    ctx.textAlign='left';
    // tecla E indicada
    ctx.fillStyle='#fff';
    ctx.font='4px "Press Start 2P"';
    ctx.textAlign='center';
    ctx.fillText('[E]', x, y+ s/2 +9);
    ctx.textAlign='left';
    // partícula periódica
    if(Math.random()<0.10){
      ctx.fillStyle=col;
      ctx.fillRect(x+randRange(-5,5), y+randRange(-5,3), 1.5,1.5);
    }
  }
}

// ===================== GATO ANTIVÍRUS (PASSIVA NORMAL - COMPANHEIRO AZUL) =====================
class GatoAntivirusPickup extends Item {
  constructor(x, y){
    super(x, y, 20, 20, 'gato_antivirus');
    this.isGatoPickup = true;
  }
  onCollect(player){
    if(player.hasGatoAntivirus) return false;
    player.hasGatoAntivirus = true;
    return true;
  }
  draw(ctx){
    const x=this.x, y=this.y + this.bob, s=this.w;
    const pulse = 0.5 + Math.sin(this.anim*2.4)*0.32;
    const col = '#3b82f6';
    // sombra
    ctx.fillStyle='rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(x, y+ s*0.45, s*0.5, 4, 0, 0, Math.PI*2); ctx.fill();
    // glow azul
    ctx.fillStyle=`rgba(59,130,246,${0.22+pulse*0.14})`;
    ctx.beginPath(); ctx.arc(x, y, s*0.7 + pulse*4, 0, Math.PI*2); ctx.fill();
    // fundo
    ctx.fillStyle='#0f172a';
    ctx.fillRect(x - s/2, y - s/2 +2, s, s-4);
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - s/2, y - s/2 +2, s, s-4);
    // faixa superior azul
    ctx.fillStyle = col;
    ctx.fillRect(x - s/2 +1, y - s/2 +2, s-2, 3);
    // ícone gato azul
    ctx.fillStyle='#fff';
    ctx.textAlign='center';
    ctx.font='14px sans-serif';
    ctx.fillText('🐱', x, y+5);
    ctx.textAlign='left';
    // brilho orelha
    ctx.fillStyle='rgba(59,130,246,0.85)';
    ctx.fillRect(x-6, y-4, 2,2);
    ctx.fillRect(x+4, y-4, 2,2);
    // indicador passiva
    ctx.fillStyle='#fff';
    ctx.font='4px "Press Start 2P"';
    ctx.textAlign='center';
    ctx.fillText('PASSIVA', x, y+ s/2 +9);
    ctx.textAlign='left';
    // partícula periódica
    if(Math.random()<0.10){
      ctx.fillStyle=col;
      ctx.fillRect(x+randRange(-5,5), y+randRange(-5,3), 1.5,1.5);
    }
  }
}

// ===================== PLAYER =====================
class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.w = PLAYER_SIZE; this.h = PLAYER_SIZE;
    this.vx = 0; this.vy = 0;
    this.speed = PLAYER_SPEED;
    this.baseSpeed = PLAYER_SPEED;
    // ========== SISTEMA DE PERSONAGENS MODULAR ==========
    this.characterId = null; // 'jg' | 'kinight' | 'jl' | null (padrão)
    this.characterDef = null;
    this.characterName = null;
    this.characterIcon = null;
    this.characterColor = null;
    // JG - Bastão
    this.hasBastao = false;
    this.bastaoProjectile = null; // referência ao projétil ativo (evita duplicação)
    this.isBastaoCharging = false;
    this.bastaoChargeTime = 0;
    this.bastaoChargeDir = null;
    this.bastaoHeavyReady = false;
    // JL - Farmar Aura (área durativa)
    this.farmarAuraActive = false;
    this.farmarAuraRadius = FARMAR_AURA_RADIUS;
    this.farmarAuraDamage = FARMAR_AURA_DAMAGE;
    // Gato Antivírus - passiva companheiro azul (item normal, não especial)
    this.hasGatoAntivirus = false;
    // LUVA - socos retos + barra foguete
    this.luvaCharge = 0;
    this.luvaChargeMax = LUVA_CHARGE_MAX;
    this.luvaPunchCooldown = 0;
    this.luvaIsCharging = false;
    this.maxHp = 6;
    this.hp = 6;
    // === Coração Cibernético - Bone Heart (recipiente cinza) ===
    // Ocupa 1 recipiente (2 HP). Max = base 6 + ossos*2. HP total inclui HP dentro dos ossos.
    this.boneHearts = 0; // número de recipientes cinza (Bone Hearts) - cada um = 1 recipiente = 2 HP
    this.maxBoneHearts = BONE_HEART_MAX_CONTAINERS; // 4 recipientes máximo (8 HP)
    // Legado Soul Heart - mantido para compatibilidade de save antigo, mas zerado no Bone Heart
    this.cyberHp = 0; // Soul Heart legado - não usado, migrado para boneHearts
    this.maxCyberHp = CYBER_HEART_MAX_CYBER; // legado
    this.lastDir = { x: 1, y: 0 };
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.invulnTimer = 0;
    this.hurtCooldown = 0;
    this.shootCooldown = 0;
    this.animTime = 0;
    this.facing = 1;
    // sistema de armas primária / secundária (Q troca)
    this.primaryWeapon = { ...WEAPON_NORMAL };
    this.secondaryWeapon = null; // só existe se pegar arma especial
    this.weapon = this.primaryWeapon; // arma atualmente equipada (referência)
    this.hasFlameTrail = false; // passivo raro
    this.hasDoubleShot = false; // melhoria arma principal: dois projéteis lado a lado
    this.didDashThisFrame = false; // flag para Game spawnar fogo
    this.dashStartPos = null;
    this.spikeTimer = 0; // cooldown espinhos
    // metralhadora aquecimento
    this.miniHeat = 0;
    this.isOverheated = false;
    this.overheatTimer = 0;
    // arma carregada (mecânica segurar para carregar)
    this.chargeTime = 0;        // ms acumulado segurando
    this.isCharging = false;    // está carregando?
    this.chargeDir = null;      // direção atual do carregamento
    this._lastChargeProgress = 0; // progresso final antes do disparo (para efeitos)
    // Espada - golpe pesado (segurar) + combo 3 golpes
    this.swordChargeTime = 0;
    this.isSwordCharging = false;
    this.swordChargeDir = null;
    this.swordHeavyReady = false; // true quando passou do prep
    this.swordCombo = 0; // 0,1,2 -> terceiro golpe é especial
    this.swordComboTimer = 0; // ms restantes para manter combo
    // Martelo - carga sísmica
    this.hammerChargeTime=0; this.isHammerCharging=false; this.hammerHeavyReady=false; this.hammerChargeDir=null;
    // Lança - arremesso retornável
    this.lancaChargeTime=0; this.isLancaCharging=false; this.lancaReady=false; this.lancaChargeDir=null; this.thrownSpear=null;
    // Machado - ciclone
    this.axeChargeTime=0; this.isAxeCharging=false; this.axeReady=false; this.axeChargeDir=null;
    this.axeSpinActive=false; this.axeSpinTimer=0; this.axeSpinTick=0;
    // Luva foguete - controle de punho ativo (dual)
    this.activeFists = []; // lista de punhos ativos (dual)
    this.activeFist = null; // compatibilidade: primeiro punho
    // Melee - animação de swing
    this.meleeAnim = 0; // ms de animação de ataque corpo a corpo
    this.meleeDir = null;
    // Motosserra - barra de cura por agressividade (ataque curto reto)
    this.motosserraCharge = 0; // 0..100
    this.motosserraChargeMax = MOTOSSERRA_CHARGE_MAX;
    this.motosserraIdleTimer = 0; // ms sem atacar para decair
    // sistema de melhorias por arma (4 raridades, valores em UPGRADE_VALUES) + níveis
    this.weaponUpgrades = { NORMAL:[], SHOTGUN:[], RAIO:[], METRALHADORA:[], CARREGADA:[], BAZUCA:[], ESPADA:[], LUVA:[], MOTOSSERRA:[], BASTAO:[], RAIO_MATEMATICO:[], ALL:[], SPECIAL:[] };
    this.obtainedUpgrades = new Set(); // ids únicos para evitar duplicação (compatibilidade)
    this.upgradeLevels = new Map(); // id -> nível atual (1..maxLevel) para melhorias com níveis
    // ================= SISTEMA ITENS ESPECIAIS (E) =================
    // Lógica separada do Player: Player apenas armazena referência, SpecialItem controla cooldown/duração.
    // Isso facilita manutenção e testes, e evita acoplar timers no Player principal.
    this.equippedSpecial = null; // SpecialItem atual ou null se nenhum equipado
    this.specialCooldownReduction = 0; // 0..0.30 - redução de recarga de especiais (10% por nível incomum)
    this.shieldActive = false;   // flag usada pelo Escudo Mágico
    this.shieldReduction = 0;    // compatibilidade
    this.shieldCharges = 0;      // 1 = absorve um dano completo
    // Power Star ⭐ - invencibilidade + dano por contato
    this.powerStarActive = false;
    this.powerStarTimer = 0;
    this.powerStarDamage = POWER_STAR_DAMAGE;
    this.powerStarHitTimers = new Map(); // enemy -> ms restantes até poder dar dano de novo
    // Sword Guardião Ágil - escudo + velocidade ao carregar espada (upgrade)
    this.swordGuardianActive = false;
    this.swordGuardianCharges = 0;
    this.swordGuardianTimer = 0; // ms restantes de escudo/velocidade após soltar
    this.swordGuardianSpeedBonus = 0;
    // Dev - Raio Matemático (exclusivo)
    this.rayMatematicoChargeTime = 0; // ms acumulado segurando
    this.isRayMatematicoCharging = false; // está carregando?
    this.rayMatematicoChargeDir = null; // direção do carregamento
    this.rayMatematicoFiredThresholds = new Set(); // thresholds já disparados (10,20...)
    this.rayMatematicoReady = false; // true quando 100% atingido
    this._lastRayMatematicoProgress = 0;
  }
  reset(x, y) {
    this.x = x; this.y = y;
    this.hp = this.maxHp;
    this.dashTimer = 0; this.dashCooldown = 0; this.invulnTimer = 0; this.hurtCooldown = 0;
    this.shootCooldown = 0;
    this.didDashThisFrame = false;
    this.spikeTimer = 0;
    this.miniHeat = 0; this.isOverheated=false; this.overheatTimer=0;
    this.chargeTime = 0; this.isCharging=false; this.chargeDir=null; this._lastChargeProgress=0;
    this.rayMatematicoChargeTime = 0; this.isRayMatematicoCharging=false; this.rayMatematicoChargeDir=null; this._lastRayMatematicoProgress=0;
    if(!this.rayMatematicoFiredThresholds) this.rayMatematicoFiredThresholds = new Set();
    else this.rayMatematicoFiredThresholds.clear();
    this.rayMatematicoReady=false;
    this.swordChargeTime=0; this.isSwordCharging=false; this.swordChargeDir=null; this.swordHeavyReady=false;
    this.swordCombo=0; this.swordComboTimer=0;
    this.swordGuardianActive=false; this.swordGuardianCharges=0; this.swordGuardianTimer=0;
    // Motosserra barra cura mantém entre salas (não zera no reset de sala, só em new game via startGame) - mas garante inicialização
    if(this.motosserraCharge===undefined) this.motosserraCharge=0;
    if(this.motosserraChargeMax===undefined) this.motosserraChargeMax=MOTOSSERRA_CHARGE_MAX;
    if(this.motosserraIdleTimer===undefined) this.motosserraIdleTimer=0;
    this.hammerChargeTime=0; this.isHammerCharging=false; this.hammerHeavyReady=false; this.hammerChargeDir=null;
    this.lancaChargeTime=0; this.isLancaCharging=false; this.lancaReady=false; this.lancaChargeDir=null; this.thrownSpear=null;
    this.axeChargeTime=0; this.isAxeCharging=false; this.axeReady=false; this.axeChargeDir=null; this.axeSpinActive=false; this.axeSpinTimer=0; this.axeSpinTick=0;
    this.activeFists=[]; this.activeFist=null;
    this.meleeAnim=0;
    // JG Bastão: mantém hasBastao entre resets de sala, mas limpa carga se estava carregando
    if(this.isBastaoCharging){ this.isBastaoCharging=false; this.bastaoChargeTime=0; this.bastaoChargeDir=null; this.bastaoHeavyReady=false; }
    // se bastão foi arremessado, projectile continua existindo (não limpa aqui para permitir retorno entre salas? Limpa se sair da sala mas mantém hasBastao false até retornar)
    // JL Farmar Aura: mantém ativo ao trocar de sala (aura segue jogador), mas limpa se não há auraRef? Mantém flag até desativar via SpecialItem
    // mantém armas e passivos entre fases; reset total só em new game via Game.startGame
  }
  // compatibilidade antiga: setWeapon agora coloca na secundária se especial, senão troca primária
  setWeapon(type) {
    const t = (type||'').toString().toLowerCase();
    // cancela carga se estiver carregando
    if(this.isCharging) this.cancelCharge();
    if(this.isRayMatematicoCharging) this.cancelRayMatematicoCharge();
    if (t==='shotgun' || t===WEAPON_SHOTGUN.name.toLowerCase()) {
      this.setSecondaryWeapon('shotgun');
      this.weapon = this.secondaryWeapon;
    } else if (t==='raio' || t==='lightning' || t===WEAPON_RAIO.name.toLowerCase()) {
      this.setSecondaryWeapon('raio');
      this.weapon = this.secondaryWeapon;
    } else if (t==='metralhadora' || t==='minigun' || t===WEAPON_METRALHADORA.name.toLowerCase()) {
      this.setSecondaryWeapon('metralhadora');
      this.weapon = this.secondaryWeapon;
    } else if (t==='carregada' || t===WEAPON_CARREGADA.name.toLowerCase()) {
      this.setSecondaryWeapon('carregada');
      this.weapon = this.secondaryWeapon;
    } else if (t==='bazuca' || t===WEAPON_BAZUCA.name.toLowerCase()) {
      this.setSecondaryWeapon('bazuca');
      this.weapon = this.secondaryWeapon;
    } else if (t==='espada' || t===WEAPON_ESPADA.name.toLowerCase()) {
      this.setSecondaryWeapon('espada');
      this.weapon = this.secondaryWeapon;
    } else if (t==='luva' || t==='luva_foguete' || t===WEAPON_LUVA.name.toLowerCase()) {
      this.setSecondaryWeapon('luva');
      this.weapon = this.secondaryWeapon;
    } else if (t==='motosserra' || t===WEAPON_MOTOSSERRA.name.toLowerCase()) {
      this.setSecondaryWeapon('motosserra');
      this.weapon = this.secondaryWeapon;
    } else if (t==='raio_matematico' || t===WEAPON_RAIO_MATEMATICO.name.toLowerCase()) {
      this.setSecondaryWeapon('raio_matematico');
      this.weapon = this.secondaryWeapon;
    } else {
      this.primaryWeapon = this.createWeaponWithUpgrades('NORMAL');
      if (this.weapon === this.primaryWeapon || !this.secondaryWeapon) this.weapon = this.primaryWeapon;
    }
  }
  setSecondaryWeapon(type){
    const t=(type||'').toString().toLowerCase();
    let wName=null;
    if(t==='shotgun' || t===WEAPON_SHOTGUN.name.toLowerCase()) wName='SHOTGUN';
    else if(t==='raio' || t==='lightning' || t===WEAPON_RAIO.name.toLowerCase()) wName='RAIO';
    else if(t==='metralhadora' || t==='minigun' || t===WEAPON_METRALHADORA.name.toLowerCase()) wName='METRALHADORA';
    else if(t==='carregada' || t===WEAPON_CARREGADA.name.toLowerCase()) wName='CARREGADA';
    else if(t==='bazuca' || t===WEAPON_BAZUCA.name.toLowerCase()) wName='BAZUCA';
    else if(t==='espada' || t===WEAPON_ESPADA.name.toLowerCase()) wName='ESPADA';
    else if(t==='luva' || t==='luva_foguete' || t===WEAPON_LUVA.name.toLowerCase()) wName='LUVA';
    else if(t==='bastao' || t===WEAPON_BASTAO.name.toLowerCase()) wName='BASTAO';
    else if(t==='motosserra' || t===WEAPON_MOTOSSERRA.name.toLowerCase()) wName='MOTOSSERRA';
    else if(t==='raio_matematico' || t===WEAPON_RAIO_MATEMATICO.name.toLowerCase()) wName='RAIO_MATEMATICO';
    // martelo/lanca/arco/machado wName removidos
    else return false;
    // ===== Restrição por personagem (modular) =====
    if(this.characterId){
      const hook = CHARACTER_HOOKS[this.characterId];
      if(hook && typeof hook.canEquipWeapon === 'function'){
        if(!hook.canEquipWeapon(this, wName)) return false;
      } else if(this.characterDef && this.characterDef.allowedWeapons){
        if(!this.characterDef.allowedWeapons.includes(wName)) return false;
      }
    }
    this.secondaryWeapon = this.createWeaponWithUpgrades(wName);
    return true;
  }
  enableDoubleShot(){
    this.hasDoubleShot = true;
    // se a primária é NORMAL, marca flag para disparar duplo
    if(this.primaryWeapon.name==='NORMAL') this.primaryWeapon.hasDoubleShot = true;
    if(this.weapon.name==='NORMAL') this.weapon.hasDoubleShot = true;
  }
  hasSecondary(){ return !!this.secondaryWeapon; }
  swapWeapon(){
    if(!this.secondaryWeapon) return false;
    // Personagens locked (JG, Kinight) não trocam via Q - mantém exclusivo. Ash pode trocar (motosserra ↔ secundária)
    if(this.characterId && (this.characterId==='jg' || this.characterId==='kinight')){
      return false;
    }
    // cancela cargas ao trocar
    if(this.isCharging) this.cancelCharge();
    if(this.isSwordCharging) this.cancelSwordCharge();
    if(this.isBastaoCharging) this.cancelBastaoCharge();
    if(this.isRayMatematicoCharging) this.cancelRayMatematicoCharge();
    // troca instantânea entre primária e secundária
    if(this.weapon === this.primaryWeapon) this.weapon = this.secondaryWeapon;
    else this.weapon = this.primaryWeapon;
    this.shootCooldown = Math.min(this.shootCooldown, 80); // leve penalidade para não spammar Q+tiro
    return true;
  }
  // ===== Sistema de Itens Especiais (E) =====
  // Métodos separados para facilitar manutenção e teste
  equipSpecial(specialItem){
    // Equipa novo item especial, descartando anterior (pode estender para inventário)
    // Aplica redução de cooldown de especiais se tiver upgrade incomum (-10% por nível)
    if(specialItem){
      if(specialItem.baseCooldown===undefined) specialItem.baseCooldown = specialItem.cooldown;
      if(this.specialCooldownReduction>0){
        specialItem.cooldown = Math.round(specialItem.baseCooldown * (1 - this.specialCooldownReduction));
      } else {
        specialItem.cooldown = specialItem.baseCooldown;
      }
      // reseta timers para novo item
      specialItem.cooldownRemaining = 0;
      specialItem.durationRemaining = 0;
      specialItem.isActive = false;
    }
    this.equippedSpecial = specialItem;
    return true;
  }
  hasSpecial(){ return !!this.equippedSpecial; }
  getSpecial(){ return this.equippedSpecial; }
  // Tenta ativar habilidade do item equipado (chamado por Game quando pressiona E)
  // Retorna objeto { ok, reason } para Game decidir mensagem/HUD
  tryUseSpecial(game){
    if(!this.equippedSpecial) return { ok:false, reason:'no_item' };
    const sp = this.equippedSpecial;
    if(!sp.canActivate()){
      if(sp.isActive) return { ok:false, reason:'active', remaining: sp.durationRemaining };
      return { ok:false, reason:'cooldown', remaining: sp.cooldownRemaining };
    }
    const activated = sp.tryActivate(this, game);
    return { ok: activated, reason: activated?'activated':'unknown' };
  }
  // ===== Sistema de Melhorias =====
  hasUpgrade(id){ 
    // para com níveis, considera que tem se nível >0
    return this.obtainedUpgrades.has(id) || (this.upgradeLevels.get(id)||0) > 0; 
  }
  getUpgradeLevel(id){
    return this.upgradeLevels.get(id) || 0;
  }
  canAddUpgrade(id){
    const def = UPGRADE_MAP.get(id);
    if(!def) return false;
    // verifica compatibilidade: se for melhoria específica, permitir mesmo se arma não equipada (pode ser para futura)
    // mas bloqueia se melhoria é incompatível com todas as armas que o jogador pode usar? Para simplificar, permite sempre, mas buildUpgradedWeapon filtra
    const maxLevel = def.maxLevel || 1;
    const curLevel = this.upgradeLevels.get(id) || 0;
    if(curLevel >= maxLevel) return false; // já no máximo, evita ficar absurdamente forte
    // para antigas sem nível, evita duplicação
    if(!def.maxLevel && this.obtainedUpgrades.has(id)) return false;
    // também verifica se melhoria é incompatível com a arma atual? Permite pegar mas só aplicará se compatível
    // Se quiser bloquear incompatíveis totalmente, descomente abaixo:
    // const compat = def.compatible || [def.weapon];
    // const owned = [this.primaryWeapon?.name, this.secondaryWeapon?.name].filter(Boolean);
    // if(def.weapon!=='ALL' && !compat.includes('ALL') && !owned.some(w=> compat.includes(w)) ) return false;
    return true;
  }
  // constrói arma com todas as melhorias já obtidas para aquele tipo (reutiliza base + aplica cumulativo com caps)
  buildUpgradedWeapon(weaponName){
    const map = { NORMAL: WEAPON_NORMAL, SHOTGUN: WEAPON_SHOTGUN, RAIO: WEAPON_RAIO, METRALHADORA: WEAPON_METRALHADORA, CARREGADA: WEAPON_CARREGADA, BAZUCA: WEAPON_BAZUCA, ESPADA: WEAPON_ESPADA, LUVA: WEAPON_LUVA, BASTAO: WEAPON_BASTAO, MOTOSSERRA: WEAPON_MOTOSSERRA, RAIO_MATEMATICO: WEAPON_RAIO_MATEMATICO };
    const base = map[weaponName];
    if(!base) return null;
    const w = { ...base };
    // coleta upgrades específicos + genéricos (ALL)
    const idsSpecific = this.weaponUpgrades[weaponName] || [];
    const idsAll = this.weaponUpgrades['ALL'] || [];
    const allIds = [...idsSpecific, ...idsAll];
    // remove duplicatas (para genéricos já em ALL)
    const uniqueIds = [...new Set(allIds)];
    for(const uid of uniqueIds){
      const def = UPGRADE_MAP.get(uid);
      if(!def || !def.apply) continue;
      // verifica compatibilidade com esta arma
      const compat = def.compatible || [def.weapon];
      const isCompat = compat.includes(weaponName) || compat.includes('ALL') || def.weapon==='ALL' || def.weapon===weaponName;
      if(!isCompat) continue;
      const level = this.upgradeLevels.get(uid) || (this.obtainedUpgrades.has(uid) ? 1 : 0);
      if(level===0) continue;
      // aplica com nível se for melhoria com níveis
      if(def.maxLevel){
        def.apply(w, level);
      } else {
        def.apply(w);
      }
    }
    if(weaponName==='NORMAL' && this.hasDoubleShot) w.hasDoubleShot=true;
    // aplica pierceCount se for pistola perfurante (níveis 1-3)
    if(weaponName==='NORMAL' && w.pierceCount){
      // já aplicado via perfurante_incomum, mas garante que pierce está ativo
      w.pierce = true;
    }
    return w;
  }
  // cria arma nova já com upgrades vinculados (usado em setSecondaryWeapon e swap)
  createWeaponWithUpgrades(weaponName){
    return this.buildUpgradedWeapon(weaponName);
  }
  // aplica melhoria imediatamente à arma correspondente e vincula para trocas futuras
  addUpgrade(id){
    if(!this.canAddUpgrade(id)) return false;
    const def = UPGRADE_MAP.get(id);
    if(!def) return false;
    // Especial incomum: Circuito Ágil - reduz recarga de itens especiais em 10% por nível (até 30%)
    if(id==='especial_incomum_recarga'){
      const curLevel = this.upgradeLevels.get(id) || 0;
      const maxLevel = def.maxLevel || 3;
      const newLevel = Math.min(curLevel + 1, maxLevel);
      const reduction = 0.10 * newLevel;
      this.specialCooldownReduction = Math.min(0.30, reduction);
      // aplica ao especial equipado atual (atualiza cooldown base)
      if(this.equippedSpecial){
        const base = this.equippedSpecial.baseCooldown !== undefined ? this.equippedSpecial.baseCooldown : this.equippedSpecial.cooldown;
        if(this.equippedSpecial.baseCooldown===undefined) this.equippedSpecial.baseCooldown = base;
        this.equippedSpecial.cooldown = Math.round(base * (1 - this.specialCooldownReduction));
        // se estiver em cooldown, ajusta proporcionalmente o restante para não punir
        if(this.equippedSpecial.cooldownRemaining>0){
          // mantém proporção do cooldown restante
          const oldMax = base * (1 - (this.specialCooldownReduction - 0.10));
          const pct = this.equippedSpecial.cooldownRemaining / oldMax;
          this.equippedSpecial.cooldownRemaining = Math.round(this.equippedSpecial.cooldown * pct);
        }
      }
      this.upgradeLevels.set(id, newLevel);
      this.obtainedUpgrades.add(id);
      let storageKey='SPECIAL';
      if(!this.weaponUpgrades[storageKey]) this.weaponUpgrades[storageKey]=[];
      if(!this.weaponUpgrades[storageKey].includes(id)) this.weaponUpgrades[storageKey].push(id);
      return true;
    }
    const wName = def.weapon;
    // sistema de níveis: incrementa nível se já tem
    const curLevel = this.upgradeLevels.get(id) || 0;
    const maxLevel = def.maxLevel || 1;
    const newLevel = Math.min(curLevel + 1, maxLevel);
    this.upgradeLevels.set(id, newLevel);
    // para compatibilidade com código antigo, também mantém em obtainedUpgrades
    this.obtainedUpgrades.add(id);
    // armazena em weaponUpgrades correto (ALL para genéricas)
    let storageKey = wName;
    // se for genérica com compatible ALL, guarda em ALL
    if(wName==='ALL' || (def.compatible && def.compatible.includes('ALL'))){
      storageKey='ALL';
    } else if(def.compatible && def.compatible.length===1){
      storageKey=def.compatible[0];
    }
    if(!this.weaponUpgrades[storageKey]) this.weaponUpgrades[storageKey]=[];
    if(!this.weaponUpgrades[storageKey].includes(id)){
      this.weaponUpgrades[storageKey].push(id);
    }
    // se possui essa arma equipada, reconstrói para aplicar efeito imediatamente (requisito)
    // Para upgrades genéricos (ALL) ou com compatível, atualiza todas as armas afetadas
    const compatList = def.compatible || [def.weapon];
    const affected = [];
    if(def.weapon==='ALL' || compatList.includes('ALL')){
      affected.push('NORMAL','SHOTGUN','RAIO','METRALHADORA','CARREGADA','BAZUCA','ESPADA','LUVA');
    } else {
      affected.push(...compatList);
    }
    if(this.primaryWeapon && affected.includes(this.primaryWeapon.name)){
      const wasEquipped = this.weapon===this.primaryWeapon;
      const upgraded = this.buildUpgradedWeapon(this.primaryWeapon.name);
      this.primaryWeapon = upgraded;
      if(wasEquipped) this.weapon = this.primaryWeapon;
    }
    if(this.secondaryWeapon && affected.includes(this.secondaryWeapon.name)){
      const wasEquipped = this.weapon===this.secondaryWeapon;
      const upgraded = this.buildUpgradedWeapon(this.secondaryWeapon.name);
      this.secondaryWeapon = upgraded;
      if(wasEquipped) this.weapon = this.secondaryWeapon;
    }
    // Se for genérico e afeta arma ainda não possuída, ficará para quando adquirir (buildUpgradedWeapon já lida)
    // se não possui ainda, ficará armazenado e será aplicado quando adquirir (cria com upgrades)
    return true;
  }
  getUpgradeCount(weaponName){
    return (this.weaponUpgrades[weaponName]||[]).length;
  }
  // ===== Mecânica arma carregada =====
  isChargedWeapon(){ return this.weapon && (this.weapon.isCharged || this.weapon.isSword); }
  isSwordChargingWeapon(){ return this.weapon && this.weapon.isSword; }
  startCharge(dir){
    if(!this.canShoot()) return false;
    if(this.isCharging) return false;
    this.isCharging = true;
    this.chargeTime = 0;
    this.chargeDir = { x: dir.x, y: dir.y };
    this._lastChargeProgress = 0;
    return true;
  }
  updateCharge(dt, dir){
    if(!this.isCharging) return;
    const maxC = this.weapon && this.weapon._chargeMax ? this.weapon._chargeMax : CHARGED_MAX_CHARGE_TIME;
    this.chargeTime += dt;
    if(this.chargeTime > maxC) this.chargeTime = maxC;
    if(dir) { this.chargeDir.x = dir.x; this.chargeDir.y = dir.y; }
  }
  cancelCharge(){
    this.isCharging = false;
    this.chargeTime = 0;
    this.chargeDir = null;
    this._lastChargeProgress = 0;
  }
  getChargeProgress(){
    if(!this.isCharging) return 0;
    const maxC = this.weapon && this.weapon._chargeMax ? this.weapon._chargeMax : CHARGED_MAX_CHARGE_TIME;
    // progresso visual 0..1 baseado no tempo máximo (cap)
    return clamp(this.chargeTime / maxC, 0, 1);
  }
  getChargeDamage(){
    const maxC = this.weapon && this.weapon._chargeMax ? this.weapon._chargeMax : CHARGED_MAX_CHARGE_TIME;
    const maxD = CHARGED_MAX_DAMAGE * (1 + (this.weapon && this.weapon._damageMaxBonus ? this.weapon._damageMaxBonus : 0));
    const effectiveMax = Math.min(maxD, CHARGED_MAX_DAMAGE * UPGRADE_CAPS.MAX_DANO_FACTOR);
    // interpolação dano: 0% carga (abaixo do mínimo) => min, 100% (max) => max efetivo
    const t = clamp((this.chargeTime - CHARGED_MIN_CHARGE_TIME) / (maxC - CHARGED_MIN_CHARGE_TIME), 0, 1);
    return lerp(CHARGED_MIN_DAMAGE, effectiveMax, t);
  }
  // dispara tiro carregado, calcula dano conforme tempo, reseta carga
  releaseCharge(){
    if(!this.isCharging) return [];
    if(!this.chargeDir) this.chargeDir = { ...this.lastDir };
    // calcula dano final
    const dmg = this.getChargeDamage();
    const progress = this.getChargeProgress();
    this._lastChargeProgress = progress;
    // configura cooldown pós disparo
    this.shootCooldown = this.weapon.cooldown;
    this.lastDir.x = this.chargeDir.x; this.lastDir.y = this.chargeDir.y;
    if(this.chargeDir.x !== 0) this.facing = this.chargeDir.x > 0 ? 1 : -1;
    // cria projétil com dano e tamanho escalado Visual
    const dir = normalize(this.chargeDir.x, this.chargeDir.y);
    const sx = this.x + dir.x * (this.w/2 + 10);
    const sy = this.y + dir.y * (this.h/2 + 8);
    // escala tamanho do projétil conforme carga (opcional visual) 4..9
    const scaledSize = lerp(this.weapon.bulletSize, this.weapon.bulletSize + 3.5, progress);
    // escala velocidade levemente 7.5..9.5 para feedback
    const scaledSpeed = lerp(this.weapon.bulletSpeed * 0.92, this.weapon.bulletSpeed, progress);
    const bullets = [];
    // verifica melhoria Muito Rara: carga máxima perfura e dispara extra
    const isMax = progress >= 0.98;
    const hasPierceUpgrade = !!this.weapon._maxPierce;
    const extraCount = isMax && this.weapon._maxExtra ? this.weapon._maxExtra : 0;
    const pierceEff = !!this.weapon.pierce || (isMax && hasPierceUpgrade);
    if(extraCount > 0){
      // modo MUITO_RARA: 3 projéteis em cone leve com dano máximo
      const baseAngle = Math.atan2(dir.y, dir.x);
      const spread = 0.22;
      for(let i=0;i<=extraCount;i++){
        let ang = baseAngle;
        if(extraCount>0){
          const t = (i / extraCount) - 0.5; // -0.5 .. 0.5
          ang += t * spread * 2;
        }
        const dx=Math.cos(ang), dy=Math.sin(ang);
        const ox = randRange(-1,1), oy=randRange(-1,1);
        bullets.push(new Bullet(sx+ox, sy+oy, dx, dy, 'player', {
          speed: scaledSpeed,
          damage: dmg,
          range: this.weapon.range,
          size: scaledSize,
          color: '#e9d5ff',
          glow: 'rgba(216,180,254,0.55)',
          pierce: pierceEff
        }));
      }
    } else {
      bullets.push(new Bullet(sx, sy, dir.x, dir.y, 'player', {
        speed: scaledSpeed,
        damage: dmg,
        range: this.weapon.range,
        size: scaledSize,
        color: progress > 0.85 ? '#d8b4fe' : this.weapon.color,
        glow: progress > 0.85 ? 'rgba(216,180,254,0.45)' : 'rgba(167,139,250,0.35)',
        pierce: pierceEff
      }));
    }
    // reseta carga para zero (requisito) e impede acumulo infinito
    this.isCharging = false;
    this.chargeTime = 0;
    this.chargeDir = null;
    return bullets;
  }
  // ===== DEV - LAZER CODIFICADO (Brimstone retângulo ondulado, dano moderado) =====
  isRayMatematicoWeapon(){ return this.weapon && !!this.weapon.isRayMatematico; }
  getRayMatematicoChargeMax(){
    // Considera upgrades: _chargeMax reduz tempo, ex: -15% por nível
    if(this.weapon && this.weapon._rayChargeMax) return this.weapon._rayChargeMax;
    // Também verifica upgrades via weapon._chargeReduction generic
    return RAIO_MATEMATICO_CHARGE_TIME;
  }
  startRayMatematicoCharge(dir){
    if(!this.canShoot()) return false;
    if(this.isRayMatematicoCharging) return false;
    if(!this.isRayMatematicoWeapon()) return false;
    this.isRayMatematicoCharging = true;
    this.rayMatematicoChargeTime = 0;
    this.rayMatematicoChargeDir = { x: dir.x, y: dir.y };
    this._lastRayMatematicoProgress = 0;
    this.rayMatematicoReady = false;
    if(!this.rayMatematicoFiredThresholds) this.rayMatematicoFiredThresholds = new Set();
    else this.rayMatematicoFiredThresholds.clear();
    return true;
  }
  updateRayMatematicoCharge(dt, dir){
    if(!this.isRayMatematicoCharging) return 0;
    const maxC = this.getRayMatematicoChargeMax();
    this.rayMatematicoChargeTime += dt;
    if(this.rayMatematicoChargeTime > maxC) this.rayMatematicoChargeTime = maxC;
    if(dir){ this.rayMatematicoChargeDir.x = dir.x; this.rayMatematicoChargeDir.y = dir.y; }
    const prog = clamp(this.rayMatematicoChargeTime / maxC, 0, 1);
    this._lastRayMatematicoProgress = prog;
    if(prog >= 0.995) this.rayMatematicoReady = true;
    return prog;
  }
  cancelRayMatematicoCharge(){
    this.isRayMatematicoCharging = false;
    this.rayMatematicoChargeTime = 0;
    this.rayMatematicoChargeDir = null;
    this._lastRayMatematicoProgress = 0;
    this.rayMatematicoReady = false;
    if(this.rayMatematicoFiredThresholds) this.rayMatematicoFiredThresholds.clear();
  }
  getRayMatematicoProgress(){
    if(!this.isRayMatematicoCharging) return 0;
    const maxC = this.getRayMatematicoChargeMax();
    return clamp(this.rayMatematicoChargeTime / maxC, 0, 1);
  }
  // Retorna null se não atingiu 100%, senão cria e retorna array com LazerBeam (Brimstone retângulo ondulado)
  // Gate rigoroso: só dispara com prog >= 0.99 (100% com tolerância) - LAZER CODIFICADO
  releaseRayMatematicoCharge(){
    if(!this.isRayMatematicoCharging) return [];
    const maxC = this.getRayMatematicoChargeMax();
    const prog = clamp(this.rayMatematicoChargeTime / maxC, 0, 1);
    const dirSource = this.rayMatematicoChargeDir ? this.rayMatematicoChargeDir : this.lastDir;
    const dir = normalize(dirSource.x, dirSource.y);
    // SEMPRE limpa estado de carga, independente de ter disparado ou não (evita travamento)
    this.isRayMatematicoCharging = false;
    this.rayMatematicoChargeTime = 0;
    this.rayMatematicoChargeDir = null;
    this._lastRayMatematicoProgress = prog;
    // Gate: não disparar antes de 100%
    if(prog < 0.99){
      // limpa thresholds para próximo ciclo sem disparar mini restantes
      if(this.rayMatematicoFiredThresholds) this.rayMatematicoFiredThresholds.clear();
      this.rayMatematicoReady=false;
      return [];
    }
    // 100% atingido: dispara LAZER CODIFICADO Brimstone (retângulo reto ondulado, dano moderado)
    this.rayMatematicoReady=false;
    if(this.rayMatematicoFiredThresholds) this.rayMatematicoFiredThresholds.clear();
    this.shootCooldown = this.weapon.cooldown;
    this.lastDir.x = dir.x; this.lastDir.y = dir.y;
    if(dir.x!==0) this.facing = dir.x>0?1:-1;
    // Características com upgrades (dano moderado já balanceado)
    const effDmg = this.weapon.damage; // já aplicado via buildUpgradedWeapon se houver upgrade dano (moderado 2.2)
    const effRange = this.weapon.range; // 460 base, upgrade amplia
    const effSize = this.weapon.bulletSize; // usado como base para width
    const effWidth = this.weapon.beamWidth ?? (effSize*2.2) ?? LAZER_BEAM_WIDTH;
    const effDuration = this.weapon.beamDuration ?? LAZER_BEAM_DURATION;
    const effColor = this.weapon.color;
    const effGlow = this.weapon.glow;
    const sx = this.x + dir.x * (this.w/2 + 10);
    const sy = this.y + dir.y * (this.h/2 + 8);
    // Tenta pegar walls do Game para clipar no disparo (evita atravessar parede)
    let walls = null;
    try{ walls = (typeof window!=='undefined' && window.game && window.game.currentRoom) ? window.game.currentRoom.walls : null; }catch(e){}
    const beam = new LazerBeam(sx, sy, dir.x, dir.y, {
      range: effRange,
      damage: effDmg,
      width: effWidth * (this.weapon._raySizeBonus ? (1+this.weapon._raySizeBonus*0.6) : 1),
      color: effColor,
      glow: effGlow,
      duration: effDuration,
      walls: walls,
      waveAmp: LAZER_BEAM_WAVE_AMP,
      waveFreq: LAZER_BEAM_WAVE_FREQ
    });
    return [beam];
  }
  // Gera mini raio para thresholds (chamado pelo Game loop). Retorna Bullet ou null.
  createRayMatematicoMini(dir){
    if(!this.weapon || !this.weapon.isRayMatematico) return null;
    const ndir = normalize(dir.x, dir.y);
    const baseDmg = this.weapon.damage * RAIO_MATEMATICO_MINI_DAMAGE_FACTOR;
    // se tem upgrade dano, mini também escala proporcionalmente (usa damage já com upgrade)
    const scaledMiniDmg = this.weapon.damage * RAIO_MATEMATICO_MINI_DAMAGE_FACTOR;
    const miniSpeed = this.weapon.bulletSpeed * RAIO_MATEMATICO_MINI_SPEED_FACTOR;
    const miniRange = this.weapon.range * RAIO_MATEMATICO_MINI_RANGE_FACTOR;
    const miniSize = RAIO_MATEMATICO_MINI_SIZE * (this.weapon._raySizeBonus ? (1+this.weapon._raySizeBonus) : 1);
    const sx = this.x + ndir.x * (this.w/2 + 8);
    const sy = this.y + ndir.y * (this.h/2 + 6);
    const b = new Bullet(sx, sy, ndir.x, ndir.y, 'player', {
      speed: miniSpeed,
      damage: scaledMiniDmg,
      range: miniRange,
      size: miniSize,
      color: RAIO_MATEMATICO_MINI_COLOR,
      glow: RAIO_MATEMATICO_MINI_GLOW,
      pierce: false,
      isMiniRay: true
    });
    return b;
  }
  hasSobremesa(){
    return !!(this.weapon && this.weapon._sobremesa);
  }
  // ===== ESPADA - Golpe pesado com preparo =====
  isSwordWeapon(){ return this.weapon && this.weapon.isSword; }
  startSwordCharge(dir){
    if(!this.canShoot()) return false;
    if(this.isSwordCharging) return false;
    this.isSwordCharging = true;
    this.swordChargeTime = 0;
    this.swordChargeDir = { x: dir.x, y: dir.y };
    this.swordHeavyReady = false;
    return true;
  }
  updateSwordCharge(dt, dir){
    if(!this.isSwordCharging) return;
    this.swordChargeTime += dt;
    if(dir){ this.swordChargeDir.x = dir.x; this.swordChargeDir.y = dir.y; }
    if(this.swordChargeTime >= this.weapon.heavyPrep) this.swordHeavyReady = true;
  }
  cancelSwordCharge(){
    this.isSwordCharging=false;
    this.swordChargeTime=0;
    this.swordChargeDir=null;
    this.swordHeavyReady=false;
  }
  getSwordChargeProgress(){
    if(!this.isSwordCharging) return 0;
    return clamp(this.swordChargeTime / this.weapon.heavyPrep, 0, 1);
  }
  releaseSwordCharge(){
    if(!this.isSwordCharging) return null;
    const isHeavy = this.swordHeavyReady && this.swordChargeTime >= this.weapon.heavyPrep;
    let dmg = isHeavy ? this.weapon.heavyDamage : this.weapon.damage;
    let range = isHeavy ? this.weapon.heavyRange : this.weapon.range;
    let angle = isHeavy ? this.weapon.heavyAngle : this.weapon.meleeAngle;
    const dir = normalize(this.swordChargeDir.x, this.swordChargeDir.y);
    // Combo para leves: 3 golpes com janela, 3º com bônus
    if(!isHeavy){
      if(this.swordComboTimer > 0){
        this.swordCombo = (this.swordCombo + 1) % 3;
      } else {
        this.swordCombo = 0;
      }
      this.swordComboTimer = this.weapon.comboWindow || 680;
      if(this.swordCombo === 1){
        dmg *= 1.12;
        range *= 1.06;
      } else if(this.swordCombo === 2){
        dmg *= (1 + (this.weapon.comboBonus||0.28));
        range *= 1.14;
        angle = Math.min(angle * 1.18, 168);
      }
      // Lunge curto para leve (avança)
      const lunge = this.weapon.lungeDist || 14;
      const nx = this.x + dir.x * lunge;
      const ny = this.y + dir.y * lunge;
      let canLunge = true;
      try{
        const walls = (typeof window!=='undefined' && window.game && window.game.currentRoom) ? window.game.currentRoom.walls : [];
        const hw = this.w/2, hh = this.h/2;
        for(const w of walls) if(rectCollide(nx-hw, ny-hh, this.w, this.h, w.x, w.y, w.w, w.h)){ canLunge=false; break; }
      }catch(e){}
      if(canLunge){
        this.x = clamp(nx, WALL_THICK + this.w/2, CANVAS_W - WALL_THICK - this.w/2);
        this.y = clamp(ny, WALL_THICK + this.h/2, CANVAS_H - WALL_THICK - this.h/2);
      }
    } else {
      // pesado reseta combo
      this.swordCombo = 0;
      this.swordComboTimer = 0;
    }
    this.shootCooldown = isHeavy ? this.weapon.heavyCooldown : this.weapon.cooldown;
    this.lastDir.x = dir.x; this.lastDir.y = dir.y;
    if(dir.x!==0) this.facing = dir.x>0?1:-1;
    this.meleeAnim = isHeavy? 220: 160;
    this.meleeDir = dir;
    this.isSwordCharging=false; this.swordChargeTime=0; this.swordChargeDir=null; this.swordHeavyReady=false;
    // cria swing (combo influencia dano/range/angle já ajustados)
    const swing = new MeleeSwing(this.x, this.y, dir.x, dir.y, {
      range: range,
      angle: angle,
      damage: dmg,
      duration: isHeavy? 180: 140,
      color: isHeavy? '#ffffff' : (this.swordCombo===2 ? '#ffd700' : '#e8e8e8'),
      glow: isHeavy? 'rgba(255,255,255,0.22)' : (this.swordCombo===2 ? 'rgba(255,215,0,0.28)' : 'rgba(200,200,220,0.18)'),
      isHeavy: isHeavy,
      weaponName: 'ESPADA'
    });
    try{ playWeaponSound('ESPADA', isHeavy); }catch(e){}
    return swing;
  }
  // ===== BASTÃO JG (EXCLUSIVO) =====
  isBastaoWeapon(){ return this.weapon && (this.weapon.isBastao || this.weapon.name==='BASTAO') || this.characterId==='jg'; }
  startBastaoCharge(dir){
    if(this.characterId!=='jg') return false;
    if(!this.hasBastao) return false; // sem bastão não pode carregar
    if(!this.canShoot()) return false;
    if(this.isBastaoCharging) return false;
    if(this.bastaoProjectile && !this.bastaoProjectile.dead) return false; // sem duplicação - só um bastão
    this.isBastaoCharging = true;
    this.bastaoChargeTime = 0;
    this.bastaoChargeDir = { x: dir.x, y: dir.y };
    this.bastaoHeavyReady = false;
    return true;
  }
  updateBastaoCharge(dt, dir){
    if(!this.isBastaoCharging) return;
    this.bastaoChargeTime += dt;
    if(dir){ this.bastaoChargeDir.x=dir.x; this.bastaoChargeDir.y=dir.y; }
    const need = this.characterDef ? this.characterDef.chargeTime : JG_BASTAO_CHARGE_TIME;
    if(this.bastaoChargeTime >= need) this.bastaoHeavyReady = true;
  }
  cancelBastaoCharge(){
    this.isBastaoCharging=false;
    this.bastaoChargeTime=0;
    this.bastaoChargeDir=null;
    this.bastaoHeavyReady=false;
  }
  getBastaoChargeProgress(){
    if(!this.isBastaoCharging) return 0;
    const need = this.characterDef ? this.characterDef.chargeTime : JG_BASTAO_CHARGE_TIME;
    return clamp(this.bastaoChargeTime / need, 0, 1);
  }
  // Cria ataque melee rápido do bastão (quando não carregou)
  createBastaoMelee(dir){
    if(!this.hasBastao) return null;
    const w = WEAPON_BASTAO;
    this.shootCooldown = w.cooldown;
    this.lastDir.x=dir.x; this.lastDir.y=dir.y;
    if(dir.x!==0) this.facing=dir.x>0?1:-1;
    this.meleeAnim=150;
    this.meleeDir=dir;
    try{ playWeaponSound('ESPADA', false); }catch(e){}
    const swing=new MeleeSwing(this.x,this.y,dir.x,dir.y,{
      range: w.range,
      angle: w.meleeAngle,
      damage: w.damage,
      duration: 140,
      color: w.color,
      glow: w.glow,
      isHeavy:false,
      weaponName:'BASTAO'
    });
    return swing;
  }
  // Arremessa bastão (carregado)
  releaseBastaoCharge(){
    if(!this.isBastaoCharging) return null;
    if(!this.hasBastao) { this.cancelBastaoCharge(); return null; }
    if(this.bastaoProjectile && !this.bastaoProjectile.dead){ this.cancelBastaoCharge(); return null; } // sem duplicação
    const prog=this.getBastaoChargeProgress();
    const isHeavy=this.bastaoHeavyReady && prog>=0.99; // só pesado se carga completa? Se soltar antes faz melee
    const dir=normalize(this.bastaoChargeDir.x,this.bastaoChargeDir.y);
    this.isBastaoCharging=false; this.bastaoChargeTime=0; this.bastaoChargeDir=null; this.bastaoHeavyReady=false;
    if(!isHeavy){
      // não carregou o suficiente => melee rápido em vez de arremesso
      return this.createBastaoMelee(dir);
    }
    // Arremesso: cria BastaoProjectile que gira e retorna
    this.hasBastao=false;
    this.shootCooldown=WEAPON_BASTAO.heavyCooldown;
    this.lastDir.x=dir.x; this.lastDir.y=dir.y;
    if(dir.x!==0) this.facing=dir.x>0?1:-1;
    this.meleeAnim=180;
    this.meleeDir=dir;
    const sx=this.x + dir.x*(this.w/2+12);
    const sy=this.y + dir.y*(this.h/2+10);
    const proj=new BastaoProjectile(sx,sy,dir.x,dir.y,{
      speed: WEAPON_BASTAO.throwSpeed,
      range: WEAPON_BASTAO.throwRange,
      damage: WEAPON_BASTAO.throwDamage || JG_BASTAO_DAMAGE,
      size: WEAPON_BASTAO.throwSize,
      color: WEAPON_BASTAO.color,
      glow: WEAPON_BASTAO.glow
    });
    this.bastaoProjectile=proj;
    try{ playWeaponSound('ESPADA', true); }catch(e){}
    return proj;
  }
  // Restaura bastão quando projectile retorna
  returnBastao(){
    this.hasBastao=true;
    this.bastaoProjectile=null;
    this.isBastaoCharging=false;
    this.bastaoChargeTime=0;
    this.shootCooldown=Math.min(this.shootCooldown, 80);
  }
  // ===== MOTOSSERRA - Barra de cura por agressividade (ataque curto reto) =====
  addMotosserraCharge(amount){
    if(!this.weapon || this.weapon.name!=='MOTOSSERRA') return false;
    if(this.motosserraCharge===undefined) this.motosserraCharge=0;
    if(this.motosserraChargeMax===undefined) this.motosserraChargeMax=MOTOSSERRA_CHARGE_MAX;
    this.motosserraCharge = Math.min(this.motosserraChargeMax, this.motosserraCharge + amount);
    this.motosserraIdleTimer = 0;
    if(this.motosserraCharge >= this.motosserraChargeMax){
      const healed = this.heal(MOTOSSERRA_HEAL_AMOUNT);
      // mesmo se vida cheia, consome barra mas dá feedback menor? Mantém recompensa só quando cura real, mas ainda zera para não travar
      this.motosserraCharge = 0;
      this.motosserraIdleTimer = 0;
      const g = (typeof window!=='undefined' && window.game) ? window.game : null;
      if(g){
        if(healed>0){
          g.showToast('🪚 SERRA SOBRECARREGADA! +1 ♥ curado!', 1500);
        } else {
          g.showToast('🪚 Sobrecarga máxima! (vida cheia)', 1200);
        }
        g.shake = Math.max(g.shake||0, 75);
        for(let k=0;k<16;k++) g.particles.push(new Particle(this.x, this.y, randRange(-1.8,1.8), randRange(-1.8,0.6), 340, '#4ade80', 2.8));
        for(let k=0;k<10;k++) g.particles.push(new Particle(this.x, this.y, randRange(-1.2,1.2), randRange(-1.4,0.4), 260, '#ffffff', 2));
        if(g.currentRoom) g.currentRoom.explosions.push({x:this.x,y:this.y,radius:12,life:340,max:340,isMotosserraHeal:true});
      }
      try{ playWeaponSound('MOTOSSERRA', true); }catch(_){}
      return true;
    } else {
      // feedback leve de carga
      const g = (typeof window!=='undefined' && window.game) ? window.game : null;
      if(g && amount>0){
        // faísca na serra a cada carga
        g.particles.push(new Particle(this.x+randRange(-6,6), this.y+randRange(-6,6), randRange(-0.6,0.6), randRange(-0.8,-0.2), 160, '#ff8c42', 1.6));
        if(this.motosserraCharge >= this.motosserraChargeMax*0.85 && Math.floor(this.motosserraCharge/5)%2===0){
          g.particles.push(new Particle(this.x, this.y-8, randRange(-0.5,0.5), -1.0, 160, '#ffcc00', 1.4));
        }
      }
    }
    return false;
  }
  getMotosserraChargePct(){
    if(this.motosserraChargeMax===undefined || this.motosserraChargeMax===0) return 0;
    return clamp((this.motosserraCharge||0) / this.motosserraChargeMax, 0, 1);
  }
  // ===== MARTELO REMOVIDO =====
  isHammerWeapon(){ return false; }
  startHammerCharge(dir){ return false; }
  updateHammerCharge(dt, dir){}
  cancelHammerCharge(){}
  getHammerChargeProgress(){ return 0; }
  releaseHammerCharge(){ return null; }
  // ===== LANÇA REMOVIDA =====
  isSpearWeapon(){ return false; }
  startLancaCharge(dir){ return false; }
  updateLancaCharge(dt, dir){}
  cancelLancaCharge(){}
  getLancaChargeProgress(){ return 0; }
  releaseLancaCharge(){ return null; }
  // ===== MACHADO REMOVIDO =====
  isAxeWeapon(){ return false; }
  startAxeCharge(dir){ return false; }
  updateAxeCharge(dt, dir){}
  cancelAxeCharge(){}
  getAxeChargeProgress(){ return 0; }
  releaseAxeCharge(){ return null; }
  isMeleeWeapon(){ return this.weapon && !!this.weapon.isMelee; }
  isFistWeapon(){ return this.weapon && !!this.weapon.isFist; }
  isBowWeapon(){ return false; }
  // Cria ataque corpo a corpo instantâneo para martelo/lança/machado/espada leve
  createMeleeSwing(dir, isHeavy=false, customOpts={}){
    const w=this.weapon;
    const isLuvaPunch = !!customOpts.isLuvaPunch;
    if(!w.isMelee && !isLuvaPunch) return null;
    // Para espada, usa lógica heavy separada; aqui é fallback
    const dmg = customOpts.damage ?? (isHeavy && w.heavyDamage ? w.heavyDamage : w.damage);
    const range = customOpts.range ?? (isHeavy && w.heavyRange ? w.heavyRange : w.range);
    const angle = customOpts.angle ?? (isHeavy && w.heavyAngle ? w.heavyAngle : w.meleeAngle);
    const dur = customOpts.duration ?? 140;
    // Luva socos usam luvaPunchCooldown, não shootCooldown global
    if(isLuvaPunch){
      // cooldown será setado no shoot, não aqui
    } else {
      this.shootCooldown = isHeavy && w.heavyCooldown ? w.heavyCooldown : w.cooldown;
    }
    this.lastDir.x=dir.x; this.lastDir.y=dir.y;
    if(dir.x!==0) this.facing=dir.x>0?1:-1;
    this.meleeAnim = isHeavy? 220: 150;
    this.meleeDir = dir;
    try{ playWeaponSound(customOpts.weaponName||w.name, isHeavy); }catch(e){}
    const swing = new MeleeSwing(this.x, this.y, dir.x, dir.y, {
      range: range,
      angle: angle,
      damage: dmg,
      duration: dur,
      color: customOpts.color ?? w.color,
      glow: customOpts.glow ?? w.glow,
      isHeavy: isHeavy,
      weaponName: customOpts.weaponName ?? w.name,
      shockRadius: customOpts.shockRadius ?? w.shockRadius ?? 0,
      shockDamage: customOpts.shockDamage ?? w.shockDamage ?? 0,
      pierce: customOpts.pierce ?? w.pierce ?? 0,
      stun: customOpts.stun ?? w._stun ?? 0
    });
    return swing;
  }
  // Cria punho foguete (dual: offsetIdx -1 esquerda, 1 direita) - lança longo quando barra cheia
  createRocketFist(dir, offsetIdx=0){
    if(!this.canShoot()) return null;
    // dual já verificado em canShoot, mas garante
    this.shootCooldown = this.weapon.cooldown;
    this.lastDir.x=dir.x; this.lastDir.y=dir.y;
    if(dir.x!==0) this.facing=dir.x>0?1:-1;
    const n=normalize(dir.x,dir.y);
    const perpX = -n.y, perpY = n.x;
    const off = (offsetIdx||0) * (this.weapon.dualOffset||10);
    const sx=this.x + n.x*(this.w/2+12) + perpX*off;
    const sy=this.y + n.y*(this.h/2+10) + perpY*off;
    const fist=new RocketFist(sx,sy,n.x,n.y,{
      speed: this.weapon.bulletSpeed,
      range: this.weapon.range,
      damage: this.weapon.damage,
      returnDamage: this.weapon.returnDamage,
      size: this.weapon.bulletSize,
      color: this.weapon.color,
      glow: this.weapon.glow,
      pierce: this.weapon.pierce||0,
      returnSpeedBonus: this.weapon._returnSpeedBonus||0,
      isJab: false
    });
    if(!this.activeFists) this.activeFists=[];
    this.activeFists.push(fist);
    this.activeFist = fist;
    try{ playWeaponSound('LUVA', true); }catch(e){}
    return fist;
  }
  // Cria soco mola curto - duas luvas vão para frente e voltam (visual novo)
  // Cada jab é um RocketFist curto com isJab=true, range pequeno e retorno elástico rápido
  createLuvaJab(dir, offsetIdx=0, chargePct=0){
    // Não verifica canShoot aqui pois caller já validou; mas garante cooldown ainda não excedido
    const n=normalize(dir.x,dir.y);
    const perpX = -n.y, perpY = n.x;
    const off = (offsetIdx||0) * ((this.weapon.dualOffset||10) * 0.85);
    const sx=this.x + n.x*(this.w/2+10) + perpX*off;
    const sy=this.y + n.y*(this.h/2+8) + perpY*off;
    // velocidade levemente escalável com carga (mais carga = jab mais rápido e sutilmente mais longo) + respeita upgrades
    const baseSpeed = this.weapon.bulletSpeed || LUVA_JAB_SPEED;
    const speed = Math.min(baseSpeed * (1 + chargePct*0.18), 18); // cap 18 para não ficar descontrolado com upgrades
    const range = (this.weapon.punchRange || LUVA_JAB_RANGE) + chargePct*12; // +12px com carga máxima dá sensação de elasticidade carregada
    const dmg = this.weapon.punchDamage || LUVA_JAB_DAMAGE;
    const retDmg = this.weapon.returnDamage || LUVA_JAB_RETURN_DAMAGE;
    const fist=new RocketFist(sx,sy,n.x,n.y,{
      speed: speed,
      range: range,
      damage: dmg,
      returnDamage: retDmg,
      size: this.weapon.bulletSize ? Math.max(8, this.weapon.bulletSize*0.92) : LUVA_JAB_SIZE,
      color: this.weapon.color || '#ff3b30',
      glow: this.weapon.glow || 'rgba(255,60,60,0.24)',
      pierce: this.weapon.pierce || 0,
      returnSpeedBonus: this.weapon._returnSpeedBonus || 0,
      isJab: true,
      jabReturnFactor: LUVA_JAB_RETURN_FACTOR,
      life: 620 // jab tem vida curta, se não retornar a tempo morre rápido
    });
    if(!this.activeFists) this.activeFists=[];
    this.activeFists.push(fist);
    this.activeFist = fist;
    return fist;
  }
  enableFlameTrail(){ this.hasFlameTrail = true; }
  heal(amount) {
    const before = this.hp;
    this.hp = clamp(this.hp + amount, 0, this.maxHp);
    return this.hp - before;
  }
  takeDamage(amount, opts = {}) {
    // Power Star: invencibilidade total
    if(this.powerStarActive) return false;
    if (this.invulnTimer > 0 || this.hurtCooldown > 0) return false;
    // Migração legado Soul -> Bone (uma vez)
    if(this.boneHearts === undefined) this.boneHearts = 0;
    if(this.maxBoneHearts === undefined) this.maxBoneHearts = BONE_HEART_MAX_CONTAINERS;
    if(this.cyberHp !== undefined && this.cyberHp > 0 && this.boneHearts === 0){
      const legacyBones = Math.ceil(this.cyberHp / 2);
      const toConvert = Math.min(legacyBones, this.maxBoneHearts);
      this.boneHearts = toConvert;
      const expectedMax = BONE_HEART_RED_CAPACITY + this.boneHearts * 2;
      if(this.maxHp < expectedMax){
        const diff = expectedMax - this.maxHp;
        this.maxHp = expectedMax;
        this.hp = Math.min(this.maxHp, this.hp + diff);
      }
      this.cyberHp = 0;
    }
    if(this.cyberHp === undefined) this.cyberHp = 0;
    if(this.maxCyberHp === undefined) this.maxCyberHp = CYBER_HEART_MAX_CYBER;
    // ===== Escudo Mágico: absorve um dano completo (prioridade sobre Bone) =====
    if(this.shieldActive && this.shieldCharges > 0){
      this.shieldCharges--;
      const gameRef = opts.game || (typeof window !== 'undefined' ? window.game : null);
      if(this.equippedSpecial && this.equippedSpecial.id === 'escudo_magico' && typeof this.equippedSpecial.onAbsorb === 'function'){
        try{ this.equippedSpecial.onAbsorb(this, gameRef || {particles:[], shake:0, currentRoom:{explosions:[]}, showToast:()=>{}}); }catch(e){}
      } else {
        this.shieldActive = false;
        this.shieldCharges = 0;
        this.shieldReduction = 0;
        if(this.equippedSpecial && this.equippedSpecial.id === 'escudo_magico'){
          this.equippedSpecial.isActive = false;
          this.equippedSpecial.durationRemaining = 0;
        }
      }
      this.invulnTimer = 120;
      return false;
    }
    // ===== ESPADA Guardião Ágil: escudo ao carregar (1 hit) =====
    if(this.swordGuardianActive && this.swordGuardianCharges > 0){
      this.swordGuardianCharges--;
      const gameRef = opts.game || (typeof window !== 'undefined' ? window.game : null);
      const particles = gameRef && gameRef.particles ? gameRef.particles : (typeof window!=='undefined' && window.game ? window.game.particles : []);
      const room = gameRef && gameRef.currentRoom ? gameRef.currentRoom : (typeof window!=='undefined' && window.game ? window.game.currentRoom : null);
      for(let k=0;k<14;k++){ const ang=Math.random()*Math.PI*2; particles.push(new Particle(this.x, this.y, Math.cos(ang)*randRange(1.4,3.4), Math.sin(ang)*randRange(1.2,3), 300, '#7ec8ff', 2)); }
      for(let k=0;k<8;k++) particles.push(new Particle(this.x, this.y, randRange(-1,1), randRange(-1,0.6), 260, '#ffffff', 2));
      if(room && room.explosions) room.explosions.push({x:this.x, y:this.y, radius:9, life:280, max:280, isShieldBlock:true});
      if(gameRef) gameRef.shake = Math.max(gameRef.shake||0, 90);
      if(gameRef && gameRef.showToast) gameRef.showToast('🛡️ Guardião quebrou — corte bloqueado!', 1300);
      if(room && room.enemies){
        for(const e of room.enemies){
          if(e.dead) continue;
          const d=dist(this.x,this.y,e.x,e.y);
          if(d<110){
            const ang=Math.atan2(e.y - this.y, e.x - this.x)||Math.random()*Math.PI*2;
            e.x+=Math.cos(ang)*14; e.y+=Math.sin(ang)*14;
            e.hitFlash = Math.max(e.hitFlash||0, 110);
            if(e.stunTimer!==undefined) e.stunTimer = Math.max(e.stunTimer||0, 140);
          }
        }
      }
      this.swordGuardianCharges = 0;
      this.swordGuardianActive = false;
      this.swordGuardianTimer = 0;
      this.swordGuardianSpeedBonus = 0;
      this.invulnTimer = 140;
      return false;
    }
    // ===== Coração Cibernético (Bone Heart) - ocupa recipiente =====
    // Bone Hearts são anexados ao final da barra (direita) e drenados da direita para a esquerda.
    // Cada recipiente leva 3 hits de ½ coração (ou 2 hits de 1 coração) para quebrar: 2 hits esvaziam o vermelho dentro,
    // 3º hit (vazio) quebra o osso permanentemente. Dano de 1 coração em osso com ½ só esvazia.
    if(this.boneHearts > 0){
      const totalMax = this.maxHp;
      const hp = this.hp;
      const boneMaxHp = this.boneHearts * 2;
      const emptyHp = totalMax - hp; // HP vazio total
      const emptyBoneHp = Math.min(boneMaxHp, emptyHp); // quanto do vazio é de osso (ossos no final)
      const fullyEmptyBones = Math.floor(emptyBoneHp / 2);
      // Se já existe pelo menos 1 recipiente cinza totalmente vazio, este dano quebra o osso em vez de tirar vida vermelha
      if(fullyEmptyBones > 0){
        const gameRef = opts.game || (typeof window !== 'undefined' ? window.game : null);
        const particles = gameRef && gameRef.particles ? gameRef.particles : (typeof window!=='undefined' && window.game ? window.game.particles : []);
        const room = gameRef && gameRef.currentRoom ? gameRef.currentRoom : (typeof window!=='undefined' && window.game ? window.game.currentRoom : null);
        this.boneHearts -= 1;
        this.maxHp -= 2;
        if(this.maxHp < BONE_HEART_RED_CAPACITY) this.maxHp = BONE_HEART_RED_CAPACITY;
        if(this.hp > this.maxHp) this.hp = this.maxHp;
        // também garante maxBoneHearts coerente
        if(this.boneHearts < 0) this.boneHearts = 0;
        this.cyberHp = 0;
        for(let k=0;k<10;k++) particles.push(new Particle(this.x, this.y, randRange(-1.6,1.6), randRange(-1.6,0.8), 360, '#a0a0b0', 2.2));
        for(let k=0;k<6;k++) particles.push(new Particle(this.x, this.y, randRange(-1,1), -1.0, 240, '#e0e0e8', 1.6));
        for(let k=0;k<4;k++) particles.push(new Particle(this.x, this.y, randRange(-1.2,1.2), randRange(-0.6,0.4), 300, 'rgba(160,160,180,0.95)', 1.8));
        if(room && room.explosions) room.explosions.push({x:this.x, y:this.y, radius:9, life:300, max:300, isBoneBreak:true});
        if(gameRef){
          gameRef.shake = Math.max(gameRef.shake||0, 90);
          if(gameRef.showToast) gameRef.showToast(`◆ Recipiente cinza quebrou! [${this.boneHearts}/${this.maxBoneHearts}]`, 1600);
        }
        this.hurtCooldown = 600;
        this.invulnTimer = 400;
        return false; // dano absorvido pela quebra do osso, sem perder vida vermelha
      }
      // Caso especial: osso com apenas ½ coração (1 HP) e dano de 1 coração (2 HP) -> só esvazia, não quebra (fiel ao Isaac)
      // Detecta: emptyBoneHp ==1 (meio vazio) e amount >=2 e boneHp atual ==1
      // Neste caso, o dano atual só esvazia, não quebra. Nosso fluxo de fullyEmptyBones já trata: não quebra agora, só esvazia.
      // Então deixa cair para redução normal de HP que vai esvaziar o osso, mas não quebrar neste hit.
    }
    // Machado ciclone: redução de dano durante giro
    if(this.axeSpinActive){
      const red=this.weapon && this.weapon.spinReduction ? this.weapon.spinReduction : 0.22;
      amount = amount * (1 - red);
      if(amount < 0.5) amount = 0.5;
    }
    // Dano normal: reduz HP. Como ossos estão no final (top layer), dano drena ossos primeiro (HP scalar).
    this.hp = Math.max(0, this.hp - amount);
    // Garante que boneHearts ainda coerente com maxHp (max = base 6 + bones*2)
    // Se por algum motivo hp > max, clamp
    if(this.hp > this.maxHp) this.hp = this.maxHp;
    // Feedback de hit em osso (quando drenou osso mas não quebrou)
    if(this.boneHearts > 0){
      const boneMaxHp = this.boneHearts * 2;
      const emptyBoneHpAfter = Math.min(boneMaxHp, this.maxHp - this.hp);
      if(emptyBoneHpAfter > 0 && emptyBoneHpAfter < boneMaxHp){
        // drenou parcialmente osso
        const gameRef = opts.game || (typeof window !== 'undefined' ? window.game : null);
        const particles = gameRef && gameRef.particles ? gameRef.particles : [];
        const room = gameRef && gameRef.currentRoom ? gameRef.currentRoom : null;
        for(let k=0;k<5;k++) particles.push(new Particle(this.x, this.y, randRange(-1.2,1.2), randRange(-1.2,0.4), 260, '#a0a0b0', 1.8));
        if(room && room.explosions) room.explosions.push({x:this.x, y:this.y, radius:7, life:200, max:200, isBoneHit:true});
        if(gameRef) gameRef.shake = Math.max(gameRef.shake||0, 45);
      }
    }
    this.hurtCooldown = 600;
    this.invulnTimer = 400;
    return true;
  }
  isAlive() { return this.hp > 0; }
  isDashing() { return this.dashTimer > 0; }
  isInvulnerable() { return this.powerStarActive || this.invulnTimer > 0 || this.isDashing(); }
  isPowerStarActive(){ return this.powerStarActive; }

  update(dt, input, walls) {
    try{
    // Bone Heart: garante consistência maxHp = base 6 + ossos*2 (migração legada)
    if(this.boneHearts !== undefined){
      const expectedMax = BONE_HEART_RED_CAPACITY + this.boneHearts*2;
      if(this.maxHp !== expectedMax && this.boneHearts>=0 && this.boneHearts<=BONE_HEART_MAX_CONTAINERS){
        // só corrige se divergir por migração ou bug, preserva hp proporcional
        this.maxHp = expectedMax;
        if(this.hp > this.maxHp) this.hp = this.maxHp;
      }
      if(this.hp < 0) this.hp = 0;
      // cyberHp legado sempre 0 no modo Bone
      if(this.cyberHp !== 0) this.cyberHp = 0;
    }
    this.animTime += dt;
    if (this.dashTimer > 0) this.dashTimer -= dt;
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.hurtCooldown > 0) this.hurtCooldown -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.spikeTimer > 0) this.spikeTimer -= dt;

    // metralhadora: controle de aquecimento e superaquecimento (com upgrades)
    const _heatPerShot = this.weapon && this.weapon._heatPerShot !== undefined ? this.weapon._heatPerShot : METRALHADORA_HEAT_PER_SHOT;
    const _heatMax = METRALHADORA_HEAT_MAX * (1 + (this.weapon && this.weapon._heatMaxBonus ? this.weapon._heatMaxBonus : 0));
    const _coolBonus = this.weapon && this.weapon._coolBonus ? this.weapon._coolBonus : 0;
    const _noPenalty = this.weapon && this.weapon._noPenalty;
    if(this.isOverheated){
      this.overheatTimer -= dt;
      this.miniHeat -= METRALHADORA_COOL_RATE_OVERHEAT * (1+_coolBonus) * dt / 16;
      if(this.miniHeat <0) this.miniHeat=0;
      if(this.overheatTimer<=0){
        this.isOverheated=false;
        this.miniHeat = _heatMax * 0.28;
      }
    } else if(!input.getShootVector()){
      // esfria quando não está segurando tiro (mesmo equipada)
      this.miniHeat -= METRALHADORA_COOL_RATE * (1+_coolBonus) * dt / 16;
      if(this.miniHeat<0) this.miniHeat=0;
    }
    // limita calor ao máximo efetivo (se upgrade aumentou)
    if(this.miniHeat > _heatMax) this.miniHeat = _heatMax;
    // velocidade: penalidade metralhadora não acumula, removida se upgrade Muito Rara
    let baseMove = PLAYER_SPEED + (this._hasSwiftBoots?0.75:0);
    if(this.weapon && this.weapon.name==='METRALHADORA'){
      if(_noPenalty) this.speed = baseMove;
      else this.speed = Math.max(1.2, baseMove - METRALHADORA_SPEED_PENALTY);
    } else {
      this.speed = baseMove;
    }
    // Personagem JG: velocidade depende do bastão (exclusivo, sem duplicação)
    if(this.characterId==='jg'){
      const def = this.characterDef || CHARACTER_DEFS.jg;
      if(this.hasBastao){
        this.speed = def.speedWithBastao + (this._hasSwiftBoots?0.75:0);
      } else {
        this.speed = def.speedWithoutBastao + (this._hasSwiftBoots?0.35:0);
      }
      // Enquanto carrega arremesso, reduz levemente para feedback de preparo
      if(this.isBastaoCharging){
        this.speed *= 0.72;
      }
    } else if(this.weapon && this.weapon.isSword && !this.swordGuardianActive){
      // Espada passiva: +8% agilidade quando equipada (mais útil para kiting) - Kinight beneficia
      this.speed = baseMove * 1.08;
    }
    // ===== ESPADA Guardião Ágil - escudo + velocidade ao carregar (upgrade) =====
    if(this.weapon && this.weapon._swordGuardian){
      if(this.isSwordCharging){
        this.swordGuardianActive = true;
        this.swordGuardianCharges = 1;
        this.swordGuardianTimer = this.weapon._guardianShieldMs ?? UPGRADE_VALUES.ESPADA_RARA_GUARDIAO_SHIELD_MS;
        this.swordGuardianSpeedBonus = this.weapon._guardianSpeed ?? UPGRADE_VALUES.ESPADA_RARA_GUARDIAO_SPEED;
        // aplica velocidade extra imediatamente sobre baseMove (sobrescreve cálculo anterior)
        this.speed = baseMove * (1 + this.swordGuardianSpeedBonus);
      } else if(this.swordGuardianActive){
        // mantém escudo/velocidade por timer após soltar
        this.swordGuardianTimer -= dt;
        if(this.swordGuardianTimer > 0){
          // mantém velocidade residual (65% do bônus) para dash pós-corte
          this.speed = baseMove * (1 + (this.swordGuardianSpeedBonus||0) * 0.65);
        } else {
          this.swordGuardianActive = false;
          this.swordGuardianCharges = 0;
          this.swordGuardianSpeedBonus = 0;
        }
      }
    } else {
      // sem upgrade guardião: gerencia expiração residual se havia escudo
      if(this.swordGuardianTimer>0){
        this.swordGuardianTimer -= dt;
        if(this.swordGuardianTimer<=0){ this.swordGuardianActive=false; this.swordGuardianCharges=0; this.swordGuardianSpeedBonus=0; }
        else {
          // mantém velocidade residual mesmo sem arma (caso trocou durante timer)
          if(this.swordGuardianActive) this.speed = baseMove * (1 + (this.swordGuardianSpeedBonus||0) * 0.50);
        }
      } else if(this.swordGuardianActive && !this.isSwordCharging){
        // sem timer e sem carga, desativa se não tem carga
        // mantém escudo até ser consumido ou até próximo frame se não for espada
        if(!this.weapon || !this.weapon._swordGuardian){
          this.swordGuardianActive=false; this.swordGuardianCharges=0;
        }
      }
    }
    // ===== BALANCEAMENTO: JL e Kinight um pouco mais lentos (pedido do usuário) =====
    // Aplica fator redutor sobre velocidade final já calculada (inclui bônus de espada, swift boots, guardião, metralhadora)
    if(this.characterId==='jl'){
      this.speed *= JL_SPEED_FACTOR; // ~2.67 vs 3.0 base
    } else if(this.characterId==='kinight'){
      this.speed *= KINIGHT_SPEED_FACTOR; // ~2.58 vs 3.0 base (tanque pesado)
    }
    // Motosserra - barra de cura por agressividade: decai se ficar idle
    if(this.motosserraCharge>0){
      this.motosserraIdleTimer += dt;
      if(this.motosserraIdleTimer > MOTOSSERRA_CHARGE_DECAY_DELAY){
        this.motosserraCharge = Math.max(0, this.motosserraCharge - MOTOSSERRA_CHARGE_DECAY_RATE * dt / 1000);
      }
    } else {
      this.motosserraIdleTimer = 0;
    }
    if(!this.weapon || this.weapon.name !== 'MOTOSSERRA'){
      if(this.motosserraCharge>0) this.motosserraCharge = Math.max(0, this.motosserraCharge - 10 * dt / 1000);
    }
    // Power Star: decrementa timers de toque por inimigo
    if(this.powerStarHitTimers && this.powerStarHitTimers.size>0){
      for(const [enemy, cd] of this.powerStarHitTimers){
        const ncd = cd - dt;
        if(ncd <= 0) this.powerStarHitTimers.delete(enemy);
        else this.powerStarHitTimers.set(enemy, ncd);
      }
    }
    // Martelo/Lança/Machado - cancela carga se trocou arma
    if(this.isHammerCharging && !this.isHammerWeapon()) this.cancelHammerCharge();
    if(this.isLancaCharging && !this.isSpearWeapon()) this.cancelLancaCharge();
    if(this.isAxeCharging && !this.isAxeWeapon()) this.cancelAxeCharge();
    // Machado ciclone ativo - timer e tick
    if(this.axeSpinActive){
      this.axeSpinTimer-=dt;
      this.axeSpinTick-=dt;
      if(this.axeSpinTimer<=0){ this.axeSpinActive=false; this.axeSpinTimer=0; this.axeSpinTick=0; }
    }
    // Lança arremessada - limpa referência se morta
    if(this.thrownSpear && this.thrownSpear.dead) this.thrownSpear=null;
    // se está carregando mas arma atual não é carregada, cancela (troca de arma)
    if(this.isCharging && !this.isChargedWeapon()){
      this.cancelCharge();
    }
    // Espada - cancela carga se trocou de arma
    if(this.isSwordCharging && !this.isSwordWeapon()){
      this.cancelSwordCharge();
    }
    // JG Bastão - cancela carga se não é JG ou sem bastão ou trocou personagem
    if(this.isBastaoCharging && (this.characterId!=='jg' || !this.hasBastao)){
      this.cancelBastaoCharge();
    }
    // Dev Raio Matemático - cancela se trocou arma
    if(this.isRayMatematicoCharging && !this.isRayMatematicoWeapon()){
      this.cancelRayMatematicoCharge();
    }
    // Se bastão foi arremessado e projectile morreu sem callback (edge), recupera
    if(this.characterId==='jg' && !this.hasBastao && (!this.bastaoProjectile || this.bastaoProjectile.dead)){
      // Verifica se passou tempo suficiente desde arremesso (evita recuperar instantâneo)
      if(this.bastaoProjectile && this.bastaoProjectile.dead){
        this.returnBastao();
      }
    }
    // Espada combo timer
    if(this.swordComboTimer > 0){
      this.swordComboTimer -= dt;
      if(this.swordComboTimer <= 0){
        this.swordCombo = 0;
        this.swordComboTimer = 0;
      }
    }
    // Animação melee decai
    if(this.meleeAnim>0) this.meleeAnim = Math.max(0, this.meleeAnim - dt);
    // Luva dual - limpa punhos retornados/mortos
    if(this.activeFists && this.activeFists.length){
      this.activeFists = this.activeFists.filter(f=> !f.dead);
      if(this.activeFists.length===0) this.activeFist=null;
      else this.activeFist = this.activeFists[0];
    } else if(this.activeFist && this.activeFist.dead) this.activeFist=null;
    // LUVA - barra de carga e cooldown de socos retos
    if(this.luvaPunchCooldown>0) this.luvaPunchCooldown-=dt;
    if(this.weapon && this.weapon.isLuva){
      const isHoldingAttack = !!input.getShootVector();
      if(isHoldingAttack){
        this.luvaIsCharging=true;
        this.luvaCharge = Math.min(this.luvaChargeMax, this.luvaCharge + LUVA_CHARGE_RATE*dt/1000);
      } else {
        this.luvaIsCharging=false;
        if(this.luvaCharge>0){
          this.luvaCharge = Math.max(0, this.luvaCharge - LUVA_CHARGE_DECAY*dt/1000);
        }
      }
    } else {
      if(this.luvaCharge>0) this.luvaCharge = Math.max(0, this.luvaCharge - LUVA_CHARGE_DECAY*dt/1000*1.2);
      this.luvaIsCharging=false;
    }

    const move = input.getMoveVector();
    let mx = move.x, my = move.y;
    if (mx !== 0 || my !== 0) {
      this.lastDir.x = mx; this.lastDir.y = my;
      this.facing = mx !== 0 ? (mx > 0 ? 1 : -1) : this.facing;
    }
    const shootVec = input.getShootVector();
    if (shootVec) { this.lastDir.x = shootVec.x; this.lastDir.y = shootVec.y; }

    this.didDashThisFrame = false;
    if (input.isDashPressed() && this.dashCooldown <= 0 && this.dashTimer <= 0) {
      let dx = this.lastDir.x, dy = this.lastDir.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      this.vx = dx * DASH_SPEED;
      this.vy = dy * DASH_SPEED;
      this.dashTimer = DASH_DURATION;
      this.dashCooldown = DASH_COOLDOWN;
      this.invulnTimer = Math.max(this.invulnTimer, DASH_INVULN);
      this.didDashThisFrame = true;
      this.dashStartPos = { x: this.x, y: this.y };
    }

    let curVx = 0, curVy = 0;
    if (this.isDashing()) { curVx = this.vx; curVy = this.vy; }
    else { curVx = mx * this.speed; curVy = my * this.speed; }

    const nextX = this.x + curVx;
    const nextY = this.y + curVy;
    if (!this.checkWallCollision(nextX, this.y, walls)) this.x = nextX;
    else { if (!this.checkWallCollision(this.x + curVx*0.5, this.y, walls)) this.x += curVx*0.5; }
    if (!this.checkWallCollision(this.x, nextY, walls)) this.y = nextY;
    else { if (!this.checkWallCollision(this.x, this.y + curVy*0.5, walls)) this.y += curVy*0.5; }

    this.x = clamp(this.x, WALL_THICK + this.w/2, CANVAS_W - WALL_THICK - this.w/2);
    this.y = clamp(this.y, WALL_THICK + this.h/2, CANVAS_H - WALL_THICK - this.h/2);
    if(isNaN(this.x) || isNaN(this.y)){
      console.warn('Player NaN corrigido', this.x, this.y);
      this.x = CANVAS_W/2; this.y = CANVAS_H/2;
    }
    }catch(e){ console.error('Player update error', e); }
  }

  checkWallCollision(nx, ny, walls) {
    const hw = this.w/2, hh = this.h/2;
    const rx = nx - hw, ry = ny - hh;
    for (const w of walls) if (rectCollide(rx, ry, this.w, this.h, w.x, w.y, w.w, w.h)) return true;
    return false;
  }
   canShoot() {
    // JG sem bastão não pode atacar (até retornar) - evita duplicação e mantém identidade
    if(this.characterId==='jg' && !this.hasBastao) return false;
    // Enquanto bastão está arremessado (projétil ativo) não pode atacar de novo
    if(this.characterId==='jg' && this.bastaoProjectile && !this.bastaoProjectile.dead) return false;
    if(this.isBastaoCharging) return false;
    if(this.weapon && this.weapon.name==='METRALHADORA' && this.isOverheated) return false;
    if(this.weapon && this.weapon.isLuva){
      const hasRocketReady = this.luvaCharge >= this.luvaChargeMax - 0.5;
      if(hasRocketReady){
        const maxF = this.weapon.isDual ? 2 : 1;
        const cnt = this.activeFists ? this.activeFists.filter(f=>!f.dead).length : 0;
        if(cnt >= maxF) return false;
        return true;
      }
      if(this.luvaPunchCooldown>0) return false;
      const cntF = this.activeFists ? this.activeFists.filter(f=>!f.dead).length : 0;
      if(cntF>0) return false;
      return true;
    }
    if(this.weapon && this.weapon.isFist){
      const maxF = this.weapon.isDual ? 2 : 1;
      const cnt = this.activeFists ? this.activeFists.filter(f=>!f.dead).length : 0;
      // compat: activeFist single
      const extra = (this.activeFist && !this.activeFist.dead && !(this.activeFists && this.activeFists.includes(this.activeFist))) ? 1 : 0;
      if(cnt + extra >= maxF) return false;
    }
     if(this.thrownSpear && !this.thrownSpear.dead) return false;
    if(this.axeSpinActive) return false;
    if(this.isSwordCharging) return false;
    if(this.isHammerCharging) return false;
    if(this.isLancaCharging) return false;
    if(this.isAxeCharging) return false;
    if(this.isRayMatematicoCharging) return false;
    // Enquanto RayMatematico carrega, bloqueia tiro normal (gate 100% trata no Game loop)
    if(this.weapon && this.weapon.isRayMatematico && this.shootCooldown>0) return false;
    return this.shootCooldown <= 0;
  }
   // Retorna array de Bullets/Swings/Fists para permitir cone, melee e projéteis especiais
  shoot(dir) {
    // aquecimento metralhadora (com upgrades)
    if(this.weapon && this.weapon.name==='METRALHADORA'){
      const hpShot = this.weapon._heatPerShot !== undefined ? this.weapon._heatPerShot : METRALHADORA_HEAT_PER_SHOT;
      const hMax = METRALHADORA_HEAT_MAX * (1 + (this.weapon._heatMaxBonus||0));
      this.miniHeat += hpShot;
      if(this.miniHeat >= hMax){
        this.miniHeat = hMax;
        this.isOverheated = true;
        this.overheatTimer = METRALHADORA_OVERHEAT_TIME;
        this.shootCooldown = this.weapon.cooldown + 120; // breve trava extra
        return []; // não dispara neste frame superaquecido
      }
    }
    // LUVA - socos retos curtos (com carga) + foguete especial quando barra cheia
    if(this.weapon && this.weapon.isLuva){
      const hasRocketReady = this.luvaCharge >= this.luvaChargeMax - 0.5;
      if(hasRocketReady){
        const before = this.activeFists ? this.activeFists.filter(f=>!f.dead).length : 0;
        const toCreate = 2 - before;
        if(toCreate <= 0) return [];
        // consome toda barra
        this.luvaCharge = 0;
        this.luvaIsCharging=false;
        // cria foguetes com efeitos de propulsão/impacto
        if(toCreate === 1){
          const f = this.createRocketFist(dir, 0);
          if(f){
            f.damage = this.weapon.damage || LUVA_ROCKET_DAMAGE;
            f.returnDamage = this.weapon.returnDamage || 1.8;
            f.speed = this.weapon.bulletSpeed || LUVA_ROCKET_SPEED;
            f.range = this.weapon.rocketRange || LUVA_ROCKET_RANGE;
            f.size = this.weapon.bulletSize || LUVA_ROCKET_SIZE;
            const p = (typeof window!=='undefined' && window.game) ? window.game.particles : null;
            if(p) for(let k=0;k<10;k++) p.push(new Particle(this.x,this.y, dir.x*randRange(1.2,2.8)+randRange(-0.6,0.6), dir.y*randRange(1.2,2.8)+randRange(-0.6,0.6), 240, '#ff8c42', 2.2));
          }
          return f ? [f] : [];
        }
        const f1 = this.createRocketFist(dir, -1);
        if(!f1) return [];
        f1.damage = this.weapon.damage || LUVA_ROCKET_DAMAGE;
        f1.returnDamage = this.weapon.returnDamage || 1.8;
        f1.speed = this.weapon.bulletSpeed || LUVA_ROCKET_SPEED;
        f1.range = this.weapon.rocketRange || LUVA_ROCKET_RANGE;
        f1.size = this.weapon.bulletSize || LUVA_ROCKET_SIZE;
        const n=normalize(dir.x,dir.y);
        const perpX=-n.y, perpY=n.x;
        const off=(this.weapon.dualOffset||10);
        const sx2=this.x + n.x*(this.w/2+12) + perpX*off;
        const sy2=this.y + n.y*(this.h/2+10) + perpY*off;
        const fist2=new RocketFist(sx2,sy2,n.x,n.y,{
          speed: this.weapon.bulletSpeed || LUVA_ROCKET_SPEED,
          range: this.weapon.rocketRange || LUVA_ROCKET_RANGE,
          damage: this.weapon.damage || LUVA_ROCKET_DAMAGE,
          returnDamage: this.weapon.returnDamage || 1.8,
          size: this.weapon.bulletSize || LUVA_ROCKET_SIZE,
          color: this.weapon.color,
          glow: this.weapon.glow,
          pierce: this.weapon.pierce||0,
          returnSpeedBonus: this.weapon._returnSpeedBonus||0,
          isJab: false
        });
        if(!this.activeFists) this.activeFists=[];
        this.activeFists.push(fist2);
        this.activeFist = fist2;
        const p2 = (typeof window!=='undefined' && window.game) ? window.game.particles : null;
        if(p2) for(let k=0;k<14;k++) p2.push(new Particle(this.x,this.y, dir.x*randRange(1.4,3)+randRange(-0.8,0.8), dir.y*randRange(1.4,3)+randRange(-0.8,0.8), 260, '#ff6a2a', 2.4));
        try{ playWeaponSound('LUVA', true); }catch(e){}
        return [f1, fist2];
      } else {
        // NOVO VISUAL: duas luvas mola vão para frente e voltam (jab elástico)
        // Antes era MeleeSwing em arco; agora são projéteis curtos tipo mola que esticam e retornam visualmente
        const chargePct = clamp(this.luvaCharge / this.luvaChargeMax, 0,1);
        const curCooldown = Math.round(lerp(LUVA_PUNCH_BASE, LUVA_PUNCH_MIN, chargePct));
        const isDual = !!this.weapon.isDual;
        const count = isDual ? 2 : 1;
        const fists=[];
        if(count===1){
          const f = this.createLuvaJab(dir, 0, chargePct);
          if(f) fists.push(f);
        } else {
          const f1j = this.createLuvaJab(dir, -1, chargePct);
          const f2j = this.createLuvaJab(dir, 1, chargePct);
          if(f1j) fists.push(f1j);
          if(f2j) fists.push(f2j);
        }
        if(fists.length===0) return [];
        this.luvaPunchCooldown = curCooldown;
        this.shootCooldown = Math.round(curCooldown*0.35);
        this.meleeAnim=90;
        this.meleeDir={x:dir.x, y:dir.y};
        try{ playWeaponSound('LUVA', false); }catch(e){}
        // partículas de mola ao lançar
        const p = (typeof window!=='undefined' && window.game) ? window.game.particles : null;
        if(p){
          for(let k=0;k<4;k++) p.push(new Particle(this.x + dir.x*12, this.y + dir.y*12, dir.x*randRange(0.8,1.6)+randRange(-0.6,0.6), dir.y*randRange(0.8,1.6)+randRange(-0.6,0.6), 150, '#ff8c42', 1.6));
          if(chargePct>0.6) for(let k=0;k<3;k++) p.push(new Particle(this.x, this.y, randRange(-1.1,1.1), randRange(-0.9,0.4), 180, 'rgba(255,220,90,0.85)', 1.4));
        }
        return fists;
      }
    }
    // fallback para outras armas isFist (compatibilidade)
    if(this.weapon && this.weapon.isFist){
      if(this.weapon.isDual){
        const before = this.activeFists ? this.activeFists.filter(f=>!f.dead).length : 0;
        const toCreate = 2 - before;
        if(toCreate <= 0) return [];
        if(toCreate === 1){
          const f = this.createRocketFist(dir, 0);
          return f ? [f] : [];
        }
        const f1 = this.createRocketFist(dir, -1);
        if(!f1) return [];
        const n=normalize(dir.x,dir.y);
        const perpX=-n.y, perpY=n.x;
        const off=(this.weapon.dualOffset||10);
        const sx2=this.x + n.x*(this.w/2+12) + perpX*off;
        const sy2=this.y + n.y*(this.h/2+10) + perpY*off;
        const fist2=new RocketFist(sx2,sy2,n.x,n.y,{
          speed: this.weapon.bulletSpeed,
          range: this.weapon.range,
          damage: this.weapon.damage,
          returnDamage: this.weapon.returnDamage,
          size: this.weapon.bulletSize,
          color: this.weapon.color,
          glow: this.weapon.glow,
          pierce: this.weapon.pierce||0,
          returnSpeedBonus: this.weapon._returnSpeedBonus||0
        });
        if(!this.activeFists) this.activeFists=[];
        this.activeFists.push(fist2);
        this.activeFist = fist2;
        try{ playWeaponSound('LUVA', false); }catch(e){}
        return [f1, fist2];
      } else {
        const fist=this.createRocketFist(dir);
        return fist ? [fist] : [];
      }
    }
    // Armas corpo a corpo instantâneas (martelo, lança, machado) - espada leve também mas pesada via charge
    if(this.weapon && this.weapon.isMelee && !this.weapon.isSword){
      const swing=this.createMeleeSwing(dir,false);
      return swing ? [swing] : [];
    }
    // Arco - flecha com rastro
    if(this.weapon && this.weapon.isBow){
      this.shootCooldown = this.weapon.cooldown;
      this.lastDir.x = dir.x; this.lastDir.y = dir.y;
      if(dir.x!==0) this.facing = dir.x>0?1:-1;
      const n=normalize(dir.x,dir.y);
      const sx=this.x + n.x*(this.w/2+10);
      const sy=this.y + n.y*(this.h/2+8);
      const ang=Math.atan2(n.y,n.x)+randRange(-0.04,0.04);
      const dx=Math.cos(ang), dy=Math.sin(ang);
      const b=new Bullet(sx,sy,dx,dy,'player',{
        speed: this.weapon.bulletSpeed,
        damage: this.weapon.damage,
        range: this.weapon.range,
        size: this.weapon.bulletSize,
        color: this.weapon.color,
        glow: this.weapon.glow,
        pierce: !!this.weapon.pierce,
        isArrow: true
      });
      return [b];
    }
    this.shootCooldown = this.weapon.cooldown;
    this.lastDir.x = dir.x; this.lastDir.y = dir.y;
    if (dir.x !== 0) this.facing = dir.x > 0 ? 1 : -1;

    // melhoria tiro duplo: se arma principal NORMAL está melhorada, dispara dois projéteis lado a lado
    if(this.weapon.name==='NORMAL' && this.hasDoubleShot){
      const bullets=[];
      // vetor perpendicular para deslocamento lateral
      const perpX = -dir.y;
      const perpY = dir.x;
      for(let side=-1; side<=1; side+=2){
        const sx = this.x + dir.x*(this.w/2+8) + perpX*DOUBLE_SHOT_OFFSET*side;
        const sy = this.y + dir.y*(this.h/2+6) + perpY*DOUBLE_SHOT_OFFSET*side;
        bullets.push(new Bullet(sx, sy, dir.x, dir.y, 'player', {
          speed: this.weapon.bulletSpeed,
          damage: this.weapon.damage,
          range: this.weapon.range,
          size: this.weapon.bulletSize,
          color: this.weapon.color,
          glow: this.weapon.glow || 'rgba(255,220,80,0.25)',
          pierce: !!this.weapon.pierce,
          pierceCount: this.weapon.pierceCount ?? (this.weapon.pierce ? 999 : 0),
          chain: this.weapon.chain||0
        }));
      }
      return bullets;
    }

    const bullets = [];
    const baseAngle = Math.atan2(dir.y, dir.x);
    const count = this.weapon.count;
    const spread = this.weapon.spread;

    for (let i=0;i<count;i++) {
      let ang = baseAngle;
      if (count > 1) {
        // distribui em cone: ex 5 pellets -> -spread .. +spread
        const t = (i / (count-1)) - 0.5; // -0.5 .. 0.5
        // adiciona pequeno jitter aleatório para espalhamento natural
        ang += t * spread * 2 + randRange(-0.06, 0.06);
      } else if (spread>0) {
        ang += randRange(-spread*0.5, spread*0.5);
      }
      const dx = Math.cos(ang), dy = Math.sin(ang);
      const sx = this.x + dir.x * (this.w/2 + 8);
      const sy = this.y + dir.y * (this.h/2 + 6);
      // diferencia levemente posição inicial para shotgun
      const ox = count>1 ? randRange(-2,2) : 0;
      const oy = count>1 ? randRange(-2,2) : 0;
      bullets.push(new Bullet(sx+ox, sy+oy, dx, dy, 'player', {
        speed: this.weapon.bulletSpeed,
        damage: this.weapon.damage,
        range: this.weapon.range,
        size: this.weapon.bulletSize,
        color: this.weapon.color,
        glow: this.weapon.glow || (this.weapon.name==='SHOTGUN' ? 'rgba(255,140,66,0.28)' : this.weapon.name==='RAIO' ? 'rgba(0,229,255,0.35)' : this.weapon.name==='BAZUCA' ? 'rgba(255,60,60,0.35)' : 'rgba(255,220,80,0.25)'),
        pierce: !!this.weapon.pierce,
        pierceCount: this.weapon.pierceCount ?? (this.weapon.pierce ? 999 : 0),
        chain: this.weapon.chain||0,
        isBazuca: !!this.weapon.isBazuca,
        explosionRadius: this.weapon.explosionRadius ?? 96,
        explosionDamage: this.weapon.explosionDamage ?? 4
      }));
    }
    return bullets;
  }

  draw(ctx) {
    if (this.isInvulnerable() && Math.floor(this.animTime / 60) % 2 === 0 && this.hurtCooldown > 0) ctx.globalAlpha = 0.45;
    let x = this.x - this.w/2;
    let y = this.y - this.h/2;
    const bob = Math.sin(this.animTime * 0.012) * 2;
    // Motosserra tremor enquanto segura ataque
    if(this.motosserraActive){
      const vib = this.motosserraVibrate || MOTOSSERRA_VIBRATE_AMP;
      x += (Math.random()-0.5)*vib;
      y += (Math.random()-0.5)*vib*0.7;
      // recuo leve na direção da mira
      if(this.motosserraDir){
        x -= this.motosserraDir.x * MOTOSSERRA_RECOIL_AMP * 0.5;
        y -= this.motosserraDir.y * MOTOSSERRA_RECOIL_AMP * 0.5;
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x+2, y + this.h - 4, this.w, 4);
    if (this.isDashing()) {
      ctx.fillStyle = 'rgba(0,217,255,0.18)';
      ctx.fillRect(x - this.vx*1.2, y - this.vy*1.2 + bob, this.w, this.h);
      ctx.fillStyle = 'rgba(0,217,255,0.12)';
      ctx.fillRect(x - this.vx*2.2, y - this.vy*2.2 + bob, this.w, this.h);
    }
    // ===== Escudo Mágico - aura visual quando ativo =====
    if(this.shieldActive){
      const pulse = 0.6 + Math.sin(this.animTime*0.012)*0.34;
      const alphaOuter = 0.12 + pulse*0.10;
      // glow externo pulsante
      ctx.fillStyle = `rgba(0,229,255,${alphaOuter})`;
      ctx.beginPath(); ctx.arc(this.x, this.y + bob, 30 + pulse*5, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = `rgba(0,229,255,${0.42 + pulse*0.22})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(this.x, this.y + bob, 22 + pulse*2.2, 0, Math.PI*2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(this.x, this.y + bob, 18, 0, Math.PI*2); ctx.stroke();
      // anel interno hexagonal (escudo)
      ctx.strokeStyle = `rgba(0,229,255,${0.65})`;
      ctx.lineWidth = 1.5;
      // hexágono simples
      ctx.beginPath();
      for(let i=0;i<6;i++){
        const ang = (i/6)*Math.PI*2 - Math.PI/6;
        const px = this.x + Math.cos(ang)*(14 + pulse*1.2);
        const py = this.y + bob + Math.sin(ang)*(14 + pulse*1.2);
        if(i===0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.stroke();
      // indicador de carga: "1" no centro do escudo
      if(this.shieldCharges > 0){
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.font = '7px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('1', this.x, this.y + bob - 26);
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(0,229,255,0.85)';
        ctx.font = '6px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('BLOQUEIO', this.x, this.y + bob - 18);
        ctx.textAlign = 'left';
      }
    }
    // ===== ESPADA Guardião Ágil - aura ciana + indicador velocidade/escudo =====
    if(this.swordGuardianActive && this.swordGuardianCharges>0){
      const pulseG = 0.55 + Math.sin(this.animTime*0.014)*0.34;
      const alphaOuterG = 0.11 + pulseG*0.09;
      ctx.fillStyle = `rgba(126,200,255,${alphaOuterG})`;
      ctx.beginPath(); ctx.arc(this.x, this.y + bob, 28 + pulseG*4, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = `rgba(126,200,255,${0.38 + pulseG*0.22})`;
      ctx.lineWidth = 1.9;
      ctx.beginPath(); ctx.arc(this.x, this.y + bob, 21 + pulseG*2.2, 0, Math.PI*2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.62)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(this.x, this.y + bob, 16.5, 0, Math.PI*2); ctx.stroke();
      // losango interno (diferencia do escudo mágico hexagonal)
      ctx.strokeStyle = `rgba(207,232,255,${0.72})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      const rG=13 + pulseG*1.2;
      ctx.moveTo(this.x, this.y + bob - rG);
      ctx.lineTo(this.x + rG, this.y + bob);
      ctx.lineTo(this.x, this.y + bob + rG);
      ctx.lineTo(this.x - rG, this.y + bob);
      ctx.closePath(); ctx.stroke();
      // indicador velocidade (setinhas)
      if(this.swordGuardianSpeedBonus>0){
        ctx.fillStyle='rgba(255,255,255,0.92)';
        ctx.font='6px monospace'; ctx.textAlign='center';
        ctx.fillText('>>', this.x, this.y + bob - 24);
        ctx.textAlign='left';
        ctx.fillStyle='rgba(126,200,255,0.92)';
        ctx.font='5px monospace'; ctx.textAlign='center';
        ctx.fillText('GUARDIÃO', this.x, this.y + bob - 17);
        ctx.textAlign='left';
        // rastro de velocidade atrás do player quando se move
        if(Math.abs(this.vx)>0.6 || Math.abs(this.vy)>0.6 || this.isSwordCharging){
          ctx.fillStyle='rgba(126,200,255,0.16)';
          ctx.fillRect(x - this.vx*0.4 -2, y - this.vy*0.4 + bob, this.w, this.h);
        }
      }
      // barra de tempo residual do escudo
      const maxG = this.weapon && this.weapon._guardianShieldMs ? this.weapon._guardianShieldMs : UPGRADE_VALUES.ESPADA_RARA_GUARDIAO_SHIELD_MS;
      const pctG = clamp(this.swordGuardianTimer / maxG, 0, 1);
      if(this.swordGuardianTimer>0 && !this.isSwordCharging){
        // mini barra sobre cabeça (só após soltar)
        const bw=18, bh=2;
        const bx=this.x - bw/2, by=y - 9 + bob;
        ctx.fillStyle='rgba(0,0,0,0.62)'; ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle='#7ec8ff'; ctx.fillRect(bx, by, bw*pctG, bh);
      }
    }
    // Espada combo 3 golpes - indicador acima (mais útil)
    if(this.weapon && this.weapon.isSword && this.swordComboTimer>0){
      const cx=this.x, cy=y - 14 + bob;
      for(let i=0;i<3;i++){
        const isActive = i <= this.swordCombo;
        const isCurrent = i===this.swordCombo;
        ctx.fillStyle = isCurrent ? (this.swordCombo===2?'#ffd700':'#ffffff') : (isActive?'#ffd700':'rgba(255,255,255,0.20)');
        ctx.strokeStyle = isActive ? 'rgba(255,215,0,0.85)' : 'rgba(255,255,255,0.14)';
        ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(cx -12 + i*12, cy, 3.5,0,Math.PI*2); ctx.fill(); ctx.stroke();
        if(isCurrent){
          ctx.fillStyle='rgba(255,215,0,0.22)'; ctx.beginPath(); ctx.arc(cx -12 + i*12, cy, 6,0,Math.PI*2); ctx.fill();
        }
      }
      const pctC = clamp(this.swordComboTimer / (this.weapon.comboWindow||680),0,1);
      ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(cx-14, cy+6, 28, 2);
      ctx.fillStyle = this.swordCombo===2 ? '#ffd700' : '#e8e8e8'; ctx.fillRect(cx-14, cy+6, 28*pctC, 2);
      if(this.swordCombo===2){
        ctx.fillStyle='rgba(255,215,0,0.92)'; ctx.font='5px monospace'; ctx.textAlign='center'; ctx.fillText('COMBO!', cx, cy-8); ctx.textAlign='left';
      }
    }
    // corpo - pernas (com armadura para Kinight, JG esportivo)
    if(this.characterId==='kinight'){
      // Grevas metálicas - Kinight com armadura completa
      ctx.fillStyle='#7a9ab8';
      ctx.fillRect(x+4, y+16 + bob, 6, 6);
      ctx.fillRect(x+14, y+16 + bob, 6, 6);
      ctx.fillStyle='#4a6b8a';
      ctx.fillRect(x+4, y+18 + bob, 6, 1);
      ctx.fillRect(x+14, y+18 + bob, 6, 1);
      ctx.fillStyle='#b8d0e8';
      ctx.fillRect(x+4, y+16 + bob, 6, 2);
      ctx.fillRect(x+14, y+16 + bob, 6, 2);
      // joelheiras
      ctx.fillStyle='#a8c8e0';
      ctx.fillRect(x+5, y+15 + bob, 4, 2);
      ctx.fillRect(x+15, y+15 + bob, 4, 2);
    } else if(this.characterId==='jg'){
      // JG - pernas esportivas pretas com faixa amarela
      ctx.fillStyle='#1a1a1a';
      ctx.fillRect(x+4, y+16 + bob, 6, 6);
      ctx.fillRect(x+14, y+16 + bob, 6, 6);
      ctx.fillStyle='#facc15';
      ctx.fillRect(x+5, y+16 + bob, 1.5, 6);
      ctx.fillRect(x+16, y+16 + bob, 1.5, 6);
      ctx.fillStyle='#2a2a2a';
      ctx.fillRect(x+6, y+18 + bob, 4, 1);
      ctx.fillRect(x+16, y+18 + bob, 4, 1);
      ctx.fillStyle='#333';
      ctx.fillRect(x+5, y+20 + bob, 6, 1.5);
      ctx.fillRect(x+15, y+20 + bob, 6, 1.5);
    } else if(this.characterId==='dev'){
      // Dev - calça branca laboratório / tênis claro
      ctx.fillStyle='#eef2f8';
      ctx.fillRect(x+4, y+16 + bob, 6, 6);
      ctx.fillRect(x+14, y+16 + bob, 6, 6);
      ctx.fillStyle='#c8d3e6';
      ctx.fillRect(x+4, y+18 + bob, 6, 1);
      ctx.fillRect(x+14, y+18 + bob, 6, 1);
      ctx.fillStyle='#a8b8d0';
      ctx.fillRect(x+5, y+20 + bob, 6, 1.2);
      ctx.fillRect(x+15, y+20 + bob, 6, 1.2);
    } else {
      ctx.fillStyle = '#3a6ea5';
      ctx.fillRect(x+4, y + 16 + bob, 6, 6);
      ctx.fillRect(x+14, y + 16 + bob, 6, 6);
    }
    // Kinight - peitoral e ombreiras (armadura) - sobrepõe antes da arma
    if(this.characterId==='kinight'){
      // peitoral metálico
      ctx.fillStyle='#8fb8d8';
      ctx.fillRect(x+4, y+8 + bob, 16, 9);
      ctx.fillStyle='#b8d0e8';
      ctx.fillRect(x+4, y+8 + bob, 16, 3);
      ctx.fillStyle='#6a9bc0';
      ctx.fillRect(x+4, y+11 + bob, 16, 1);
      ctx.fillStyle='#a8c8e0';
      ctx.fillRect(x+2, y+7 + bob, 4, 6);
      ctx.fillRect(x+18, y+7 + bob, 4, 6);
      ctx.fillStyle='#7a9ab8';
      ctx.fillRect(x+2, y+10 + bob, 4, 3);
      ctx.fillRect(x+18, y+10 + bob, 4, 3);
      // cinto com fivela
      ctx.fillStyle='#4a6b8a';
      ctx.fillRect(x+6, y+14 + bob, 12, 2);
      ctx.fillStyle='#ffd700';
      ctx.fillRect(x+11, y+14 + bob, 2, 2);
    } else if(this.characterId==='jg'){
      // JG - camisa amarela esportiva nº10
      ctx.fillStyle='#facc15';
      ctx.fillRect(x+4, y+8 + bob, 16, 9);
      ctx.fillStyle='#fffbeb';
      ctx.fillRect(x+4, y+8 + bob, 16, 2.5);
      ctx.fillStyle='#1a1a1a';
      ctx.fillRect(x+11, y+10 + bob, 2, 6); // faixa central preta
      ctx.fillStyle='#0f0f0f';
      ctx.fillRect(x+4, y+8 + bob, 1.5, 9);
      ctx.fillRect(x+18.5, y+8 + bob, 1.5, 9);
      // número 10 peito
      ctx.fillStyle='#1a1a1a';
      ctx.font='5px "Press Start 2P"';
      ctx.textAlign='center';
      ctx.fillText('10', x+12, y+14 + bob);
      ctx.textAlign='left';
      // gola
      ctx.fillStyle='#e8b800';
      ctx.fillRect(x+9, y+8 + bob, 6, 1.5);
      // braçadeiras
      ctx.fillStyle='#1a1a1a';
      ctx.fillRect(x+4, y+11 + bob, 3, 2);
      ctx.fillRect(x+17, y+11 + bob, 3, 2);
    } else if(this.characterId==='dev'){
      // Dev - jaleco branco de cientista/programador com detalhes ciano e crachá
      ctx.fillStyle='#ffffff';
      ctx.fillRect(x+4, y+8 + bob, 16, 9);
      ctx.fillStyle='#e6f0ff';
      ctx.fillRect(x+4, y+8 + bob, 16, 2.8);
      ctx.fillStyle='#7af2ff';
      ctx.fillRect(x+11, y+9 + bob, 2, 6); // fecho central
      ctx.fillStyle='#1a1a2a';
      ctx.fillRect(x+11, y+10 + bob, 2, 1); // botão
      ctx.fillRect(x+11, y+13 + bob, 2, 1);
      ctx.fillStyle='#b8d0ff';
      ctx.fillRect(x+4, y+8 + bob, 1.2, 9);
      ctx.fillRect(x+18.8, y+8 + bob, 1.2, 9);
      // crachá Dev
      ctx.fillStyle='#0a4a5e';
      ctx.fillRect(x+14, y+11 + bob, 4, 3);
      ctx.fillStyle='#7af2ff';
      ctx.fillRect(x+14.5, y+11.5 + bob, 3, 1);
      ctx.fillStyle='#ffffff';
      ctx.fillRect(x+15, y+12.8 + bob, 2, 0.8);
      // gola jaleco
      ctx.fillStyle='#d0e6ff';
      ctx.fillRect(x+8, y+8 + bob, 2, 2);
      ctx.fillRect(x+14, y+8 + bob, 2, 2);
      // bolso com caneta
      ctx.strokeStyle='rgba(122,242,255,0.55)'; ctx.lineWidth=0.8;
      ctx.strokeRect(x+5, y+11 + bob, 3, 3);
      ctx.fillStyle='#ff6a00'; ctx.fillRect(x+6, y+10 + bob, 0.8, 2);
    }
    // arma visual diferente - novas armas comuns com identidade visual distinta + Bastão JG + Motosserra
    const isShotgun = this.weapon.name==='SHOTGUN';
    const isRaio = this.weapon.name==='RAIO';
    const isMini = this.weapon.name==='METRALHADORA';
    const isCarregada = this.weapon.name==='CARREGADA';
    const isBazuca = this.weapon.name==='BAZUCA';
    const isEspada = this.weapon.name==='ESPADA';
    const isLuva = this.weapon.name==='LUVA';
    const isBastao = this.weapon.name==='BASTAO' || (this.characterId==='jg' && this.weapon.name==='BASTAO');
    const isMotosserra = this.weapon.name==='MOTOSSERRA';
    const isRayMatematico = this.weapon.name==='RAIO_MATEMATICO';
    const isMartelo = false;
    const isLanca = false;
    const isArco = false;
    const isMachado = false;
    if (isRayMatematico){
      const prog = this.isRayMatematicoCharging ? this.getRayMatematicoProgress() : 0;
      if(this.isRayMatematicoCharging){
        if(prog >= 0.99) ctx.fillStyle='#ffffff';
        else if(prog > 0.65) ctx.fillStyle='#7af2ff';
        else if(prog > 0.35) ctx.fillStyle='#1a8fb3';
        else ctx.fillStyle='#0a4a5e';
      } else ctx.fillStyle='#0a4a5e';
    } else if (isRaio) ctx.fillStyle = '#00e5ff';
    else if (isShotgun) ctx.fillStyle = '#ff8c42';
    else if (isMini) ctx.fillStyle = this.isOverheated ? '#7a1a1a' : '#ff3b30';
    else if (isCarregada) {
      const prog = this.isCharging ? this.getChargeProgress() : 0;
      if(this.isCharging) ctx.fillStyle = prog > 0.85 ? '#d8b4fe' : prog > 0.5 ? '#a78bfa' : '#7c3aed';
      else ctx.fillStyle = '#7c3aed';
    } else if (isBazuca) ctx.fillStyle = '#ff3b30';
    else if (isEspada) {
      const prog=this.isSwordCharging? this.getSwordChargeProgress():0;
      if(this.isSwordCharging) ctx.fillStyle = prog>0.85 ? '#ffffff' : prog>0.5 ? '#e8e8e8' : '#a0a0b8';
      else ctx.fillStyle = '#d0d0d8';
    }
    else if (isLuva) ctx.fillStyle = (this.activeFists && this.activeFists.length>0) || this.activeFist ? '#6b1a1a' : '#ff3b30';
    else if (isMotosserra) {
      ctx.fillStyle = this.weapon.hasPochita ? '#ff8c42' : '#c0392b';
    }
    else if (isBastao) {
      if(this.characterId==='jg' && !this.hasBastao) ctx.fillStyle='rgba(60,50,0,0.45)';
      else if(this.isBastaoCharging){
        const prog=this.getBastaoChargeProgress();
        ctx.fillStyle = prog>0.85 ? '#ffffff' : prog>0.5 ? '#fde68a' : '#facc15';
      } else ctx.fillStyle = '#facc15';
    }
    else if (isMartelo) ctx.fillStyle = '#8a6d3b';
    else if (isLanca) ctx.fillStyle = '#c0a080';
    else if (isArco) ctx.fillStyle = '#4ade80';
    else if (isMachado) ctx.fillStyle = '#ff8c42';
    else ctx.fillStyle = '#5a8fd4';
    ctx.fillRect(x+3, y+8 + bob, 18, 10);
    if (isShotgun) {
      ctx.fillStyle='#1a1a1a';
      ctx.fillRect(x+6, y+11 + bob, 12, 2);
      ctx.fillStyle='#ffcc00';
      ctx.fillRect(x+8, y+13 + bob, 8, 1);
    } else if (isRaio) {
      ctx.fillStyle='#e0ffff';
      ctx.fillRect(x+7, y+10 + bob, 10, 2);
      ctx.fillStyle='#ffffff';
      ctx.fillRect(x+9, y+11 + bob, 2, 2);
      ctx.fillRect(x+11, y+10 + bob, 2, 3);
      ctx.fillRect(x+13, y+11 + bob, 2, 2);
    } else if (isMini) {
      ctx.fillStyle='#1a1a1a';
      ctx.fillRect(x+5, y+10 + bob, 14, 3);
      ctx.fillStyle=this.isOverheated ? '#ff6a00' : '#ffcc00';
      // cano metralhadora com brilho aquecido
      const heatF = this.miniHeat / METRALHADORA_HEAT_MAX;
      if(heatF>0.5){
        ctx.fillStyle=`rgba(255,${Math.floor(60+heatF*120)},0,0.9)`;
        ctx.fillRect(x+6, y+11 + bob, 12, 1);
      }
      ctx.fillStyle='#555';
      ctx.fillRect(x+7, y+13 + bob, 10, 1);
    } else if (isCarregada) {
      // núcleo brilhante da arma carregada
      const prog = this.isCharging ? this.getChargeProgress() : 0;
      ctx.fillStyle='#1a0a2e';
      ctx.fillRect(x+6, y+11 + bob, 12, 2);
      if(this.isCharging){
        // barra de energia interna pulsando conforme carga
        ctx.fillStyle = prog > 0.85 ? '#ffffff' : prog > 0.5 ? '#e9d5ff' : '#c4b5fd';
        ctx.fillRect(x+7, y+11 + bob, Math.floor(10 * prog) + 2, 2);
        // brilho externo quando alta carga
        if(prog > 0.7){
          ctx.fillStyle=`rgba(167,139,250,${0.15 + prog*0.25})`;
          ctx.fillRect(x+1, y+6 + bob, 22, 14);
        }
        if(prog >= 0.99){
          // cintilância máxima
          ctx.fillStyle='rgba(255,255,255,0.85)';
          if(Math.floor(this.animTime/80)%2===0) ctx.fillRect(x+9, y+9 + bob, 6, 1);
        }
      } else {
        ctx.fillStyle='#a78bfa';
        ctx.fillRect(x+8, y+11 + bob, 8, 2);
        ctx.fillStyle='#c4b5fd';
        ctx.fillRect(x+9, y+6 + bob, 1, 4);
      }
    } else if (isBazuca) {
      ctx.fillStyle='#2a1a0a';
      ctx.fillRect(x+4, y+9 + bob, 14, 6);
      ctx.fillStyle='#ff3b30';
      ctx.fillRect(x+5, y+11 + bob, 12, 2);
      ctx.fillStyle='#ffcc00';
      ctx.fillRect(x+6, y+7 + bob, 2, 2);
      ctx.fillRect(x+14, y+7 + bob, 2, 2);
      ctx.fillStyle='#555';
      ctx.fillRect(x+7, y+13 + bob, 10, 1);
    } else if (isEspada) {
      // espada: lâmina + guarda + brilho de carga pesada
      const prog=this.isSwordCharging? this.getSwordChargeProgress():0;
      ctx.fillStyle='#2a2a2e'; ctx.fillRect(x+5, y+11 + bob, 14, 2);
      // lâmina
      ctx.fillStyle= this.isSwordCharging && prog>0.85 ? '#ffffff' : '#e8e8e8';
      ctx.fillRect(x+6, y+6 + bob, 10, 2);
      ctx.fillStyle='#a0a0b8'; ctx.fillRect(x+6, y+7 + bob, 10, 1);
      // guarda dourada
      ctx.fillStyle='#c0a030'; ctx.fillRect(x+7, y+9 + bob, 8, 2);
      // brilho heavy
      if(this.isSwordCharging && prog>0.7){
        ctx.fillStyle=`rgba(255,255,255,${0.18+prog*0.22})`;
        ctx.fillRect(x+2, y+5 + bob, 20, 8);
      }
      if(this.isSwordCharging && prog>=0.99){
        ctx.fillStyle='rgba(255,255,255,0.82)';
        if(Math.floor(this.animTime/80)%2===0) ctx.fillRect(x+8, y+4 + bob, 6,1);
      }
    } else if (isLuva) {
      // NOVO VISUAL: duas luvas de boxe com mola elástica
      // - Quando idle: duas luvas lado a lado com leve pulsação de carga
      // - Quando ativas (jab ou foguete): desenha mola zigue-zague elástica de cada punho até o jogador
      const fists = (this.activeFists && this.activeFists.length ? this.activeFists : (this.activeFist && !this.activeFist.dead ? [this.activeFist] : []));
      if(fists.length>0){
        // base alongada quando esticado
        ctx.fillStyle='#1a0f0a'; ctx.fillRect(x+6, y+10 + bob, 12, 3.2);
        ctx.fillStyle='#3a1f14'; ctx.fillRect(x+7, y+11 + bob, 10,1);
        // mola elástica zigue-zague para cada punho ativo
        for(const f of fists){
          const sx = x+12, sy = y+11+bob;
          const ex = f.x - this.x + x+12;
          const ey = f.y - this.y + y+11 + (f.isJab ? 0 : Math.sin(Date.now()*0.022)*0.8);
          const distM = Math.hypot(ex - sx, ey - sy);
          const isJab = !!f.isJab;
          // amplitude cresce com distância para sensação de elasticidade
          const amp = clamp(distM / 22, 1.8, 5.2);
          const segs = isJab ? 7 : 8;
          // cor da mola: jab = marrom/laranja elástico, foguete = metálico laranja/vermelho com brilho
          const springCol = isJab ? 'rgba(90,45,18,0.92)' : 'rgba(120,40,12,0.94)';
          const springHiCol = isJab ? 'rgba(255,160,60,0.85)' : 'rgba(255,120,40,0.92)';
          // sombra/fundo da mola
          drawLuvaSpring(ctx, sx, sy, ex, ey, segs, amp, 'rgba(0,0,0,0.16)', 3.6);
          // mola principal
          drawLuvaSpring(ctx, sx, sy, ex, ey, segs, amp, springCol, 2.2);
          // brilho interno da mola (linha mais fina clara no centro do zigzag)
          drawLuvaSpring(ctx, sx, sy, ex, ey, segs, amp*0.45, springHiCol, 0.9);
          // conector metálico no punho (pequeno cilindro)
          ctx.fillStyle='rgba(30,16,8,0.92)';
          ctx.beginPath(); ctx.arc(ex - (f.dirX||0)*5, ey - (f.dirY||0)*5, 1.8,0,Math.PI*2); ctx.fill();
        }
        // aura pulsante no peito quando jab ativo
        const anyJab = fists.some(ff=>ff.isJab);
        const anyRocket = fists.some(ff=>!ff.isJab);
        if(anyJab){
          ctx.fillStyle='rgba(255,120,60,0.13)'; ctx.beginPath(); ctx.arc(x+12, y+11+bob, 7,0,Math.PI*2); ctx.fill();
        }
        if(anyRocket){
          ctx.fillStyle='rgba(255,80,30,0.18)'; ctx.beginPath(); ctx.arc(x+12, y+11+bob, 9,0,Math.PI*2); ctx.fill();
        }
        // indicador dual + tipo
        ctx.fillStyle='rgba(255,255,255,0.90)'; ctx.font='5px monospace'; ctx.textAlign='center';
        const label = anyRocket ? 'FOGUETE '+fists.length+'/2' : 'MOLA '+fists.length+'/2';
        ctx.fillText(label, x+12, y+7+bob); ctx.textAlign='left';
      } else {
        // idle: duas luvas lado a lado com animação de respiração e carga
        const chargePct = clamp((this.luvaCharge||0)/ (this.luvaChargeMax||100),0,1);
        const pulse = 0.5 + Math.sin(this.animTime*0.012)*0.18 + chargePct*0.32;
        // brilho de carga carregando (segurando)
        if(this.luvaIsCharging && chargePct>0.2){
          ctx.fillStyle=`rgba(255,140,40,${0.10+chargePct*0.18})`;
          ctx.beginPath(); ctx.arc(x+12, y+11+bob, 9+chargePct*6,0,Math.PI*2); ctx.fill();
          ctx.fillStyle=`rgba(255,215,0,${0.06+chargePct*0.12})`;
          ctx.beginPath(); ctx.arc(x+12, y+11+bob, 6+chargePct*4,0,Math.PI*2); ctx.fill();
        }
        // sombra base luvas
        ctx.fillStyle='rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(x+8, y+15+bob, 4.5,1.6,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x+16, y+15+bob, 4.5,1.6,0,0,Math.PI*2); ctx.fill();
        // luva esquerda
        ctx.fillStyle = chargePct>=0.99 ? '#ffd700' : chargePct>0.6 ? '#ff6b3a' : '#ff3b30';
        ctx.beginPath(); ctx.arc(x+8 + Math.sin(this.animTime*0.014)*0.6, y+11+bob+ Math.cos(this.animTime*0.010)*0.5, 4.4+ pulse*0.6,0,Math.PI*2); ctx.fill();
        ctx.fillStyle= chargePct>=0.99 ? '#fff8c0' : '#ff8a6a'; ctx.beginPath(); ctx.arc(x+8, y+11+bob, 2.7,0,Math.PI*2); ctx.fill();
        // brilho luva esq
        ctx.fillStyle='rgba(255,255,255,0.92)'; ctx.beginPath(); ctx.arc(x+6.6, y+9.6+bob,1.1,0,Math.PI*2); ctx.fill();
        // luva direita
        ctx.fillStyle = chargePct>=0.99 ? '#ffd700' : chargePct>0.6 ? '#ff6b3a' : '#ff3b30';
        ctx.beginPath(); ctx.arc(x+16 + Math.sin(this.animTime*0.014+1.2)*0.6, y+11+bob+ Math.cos(this.animTime*0.010+1.2)*0.5, 4.4+ pulse*0.6,0,Math.PI*2); ctx.fill();
        ctx.fillStyle= chargePct>=0.99 ? '#fff8c0' : '#ff8a6a'; ctx.beginPath(); ctx.arc(x+16, y+11+bob, 2.7,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.92)'; ctx.beginPath(); ctx.arc(x+14.6, y+9.6+bob,1.1,0,Math.PI*2); ctx.fill();
        // punhos / faixas pretas
        ctx.fillStyle='#1a0a0a'; ctx.fillRect(x+6, y+12.5+bob, 6.2,1.9);
        ctx.fillStyle='#1a0a0a'; ctx.fillRect(x+13.8, y+12.5+bob, 6.2,1.9);
        // faixa dourada central quando quase carregado
        if(chargePct>0.45){
          ctx.fillStyle= chargePct>=0.99 ? 'rgba(255,255,255,0.95)' : 'rgba(255,215,0,0.92)';
          ctx.fillRect(x+7.2, y+10.2+bob, 1.6,2.4);
          ctx.fillRect(x+15.2, y+10.2+bob, 1.6,2.4);
        } else {
          ctx.fillStyle='rgba(255,200,60,0.92)'; ctx.fillRect(x+7.2, y+10.2+bob, 1.4,2.2);
          ctx.fillRect(x+15.2, y+10.2+bob, 1.4,2.2);
        }
        // costura luvas (pontos)
        ctx.fillStyle='rgba(0,0,0,0.22)';
        ctx.beginPath(); ctx.arc(x+8, y+13.2+bob,0.6,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(x+8, y+14.4+bob,0.6,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x+16, y+13.2+bob,0.6,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(x+16, y+14.4+bob,0.6,0,Math.PI*2); ctx.fill();
        // indicador carga pequena acima quando carregando
        if(this.luvaIsCharging){
          ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.font='4px monospace'; ctx.textAlign='center';
          ctx.fillText(Math.round(chargePct*100)+'%', x+12, y+5+bob); ctx.textAlign='left';
        }
      }
    } else if (isMotosserra) {
      if(this.characterId==='ash'){
        // Ash já tem motosserra acoplada na mão (modelo), não precisa serra flutuante separada - só aura
        const hasPochitaAsh = !!this.weapon.hasPochita;
        ctx.fillStyle= hasPochitaAsh ? 'rgba(255,180,60,0.16)' : 'rgba(255,60,60,0.14)'; ctx.beginPath(); ctx.arc(x+12, y+12+bob, 10,0,Math.PI*2); ctx.fill();
        if(this.motosserraActive){ ctx.fillStyle= hasPochitaAsh ? 'rgba(255,180,60,0.28)' : 'rgba(255,60,60,0.26)'; ctx.beginPath(); ctx.arc(x+12, y+12+bob, 13,0,Math.PI*2); ctx.fill(); }
        if(hasPochitaAsh){
          const sideSpinA = this.animTime * 0.045;
          for(const side of [-1,1]){
            const sx = this.x + side*19, sy = this.y + bob - 1;
            ctx.fillStyle='rgba(0,0,0,0.16)'; ctx.beginPath(); ctx.ellipse(sx, sy+11, 6, 2.2, 0,0,Math.PI*2); ctx.fill();
            ctx.strokeStyle='rgba(60,30,10,0.72)'; ctx.lineWidth=2.2; ctx.beginPath(); ctx.moveTo(this.x + side*8, this.y+3+bob); ctx.lineTo(sx, sy+3); ctx.stroke();
            ctx.strokeStyle='rgba(255,140,60,0.44)'; ctx.lineWidth=1.3; ctx.beginPath(); ctx.moveTo(this.x + side*8, this.y+3+bob); ctx.lineTo(sx, sy+3); ctx.stroke();
            ctx.fillStyle='#1a0a0a'; ctx.fillRect(sx-5, sy-1, 10, 4);
            ctx.save(); ctx.translate(sx, sy+2); ctx.rotate(sideSpinA * (side===1?1:-1));
            ctx.fillStyle='#e8e8e8'; ctx.beginPath(); ctx.arc(0,0, 5.2,0,Math.PI*2); ctx.fill();
            ctx.strokeStyle='#ff3b30'; ctx.lineWidth=1; for(let i=0;i<6;i++){ const ang=(i/6)*Math.PI*2; ctx.beginPath(); ctx.moveTo(Math.cos(ang)*2.4, Math.sin(ang)*2.4); ctx.lineTo(Math.cos(ang)*5.8, Math.sin(ang)*5.8); ctx.stroke(); }
            ctx.fillStyle='#1a0a0a'; ctx.beginPath(); ctx.arc(0,0, 1.8,0,Math.PI*2); ctx.fill(); ctx.restore();
            ctx.fillStyle='rgba(255,180,60,0.20)'; ctx.beginPath(); ctx.arc(sx, sy+2, 8,0,Math.PI*2); ctx.fill();
          }
          ctx.fillStyle='#ff6a00'; ctx.font='bold 5px monospace'; ctx.textAlign='center'; ctx.fillText('CHAINSAW', x+12, y+5+bob); ctx.textAlign='left';
          ctx.fillStyle='#ffb347'; ctx.font='5px monospace'; ctx.textAlign='center'; ctx.fillText('POCHITA x5', x+12, y+7.5+bob); ctx.textAlign='left';
        }
      } else {
      // MOTOSSERRA - incomum, visual com serra girando + Pochita adiciona 2 laterais
      const hasPochita = !!this.weapon.hasPochita;
      const spin = this.animTime * MOTOSSERRA_SAW_SPIN_SPEED;
      // base central
      ctx.fillStyle='#1a0a0a'; ctx.fillRect(x+4, y+9+bob, 16, 6);
      ctx.fillStyle='#2a2a2e'; ctx.fillRect(x+6, y+10+bob, 12, 4);
      ctx.fillStyle= hasPochita ? '#ff6a00' : '#ff3b30'; ctx.fillRect(x+5, y+11+bob, 14, 2);
      // serra central girando
      ctx.save(); ctx.translate(x+12, y+12+bob); ctx.rotate(spin);
      ctx.fillStyle='#e8e8e8'; ctx.beginPath(); ctx.arc(0,0,4.2,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#ff3b30'; ctx.lineWidth=1;
      for(let i=0;i<6;i++){ const ang=(i/6)*Math.PI*2; ctx.beginPath(); ctx.moveTo(Math.cos(ang)*2.2, Math.sin(ang)*2.2); ctx.lineTo(Math.cos(ang)*5.2, Math.sin(ang)*5.2); ctx.stroke(); }
      ctx.fillStyle='#1a1a1a'; ctx.beginPath(); ctx.arc(0,0,1.6,0,Math.PI*2); ctx.fill();
      ctx.restore();
      if(hasPochita){
        // duas serras laterais na arma - aumentam alcance/poder visualmente
        for(const side of [-1,1]){
          const sx = x+12 + side*10, sy=y+12+bob;
          ctx.save(); ctx.translate(sx, sy); ctx.rotate(-spin*0.85);
          ctx.fillStyle='rgba(255,180,60,0.92)'; ctx.beginPath(); ctx.arc(0,0,3.4,0,Math.PI*2); ctx.fill();
          ctx.strokeStyle='#ff8c42'; ctx.lineWidth=0.9;
          for(let i=0;i<5;i++){ const ang=(i/5)*Math.PI*2; ctx.beginPath(); ctx.moveTo(Math.cos(ang)*1.8, Math.sin(ang)*1.8); ctx.lineTo(Math.cos(ang)*4.2, Math.sin(ang)*4.2); ctx.stroke(); }
          ctx.fillStyle='#1a0a0a'; ctx.beginPath(); ctx.arc(0,0,1.2,0,Math.PI*2); ctx.fill();
          ctx.restore();
          // braço conector arma
          ctx.fillStyle='rgba(255,180,60,0.32)'; ctx.fillRect(side===-1? x+2: x+18, y+11+bob, 4, 1.5);
        }
        // aura Pochita central
        ctx.fillStyle='rgba(255,180,60,0.14)'; ctx.beginPath(); ctx.arc(x+12, y+12+bob, 16,0,Math.PI*2); ctx.fill();
        // NOVO: 2 motosserras extras à direita e esquerda do PERSONAGEM (referência Chainsaw Man - Denji)
        const sideSpin = this.animTime * 0.045;
        for(const side of [-1,1]){
          const sx = this.x + side*19, sy = this.y + bob - 1;
          // sombra no chão
          ctx.fillStyle='rgba(0,0,0,0.16)'; ctx.beginPath(); ctx.ellipse(sx, sy+11, 6, 2.2, 0,0,Math.PI*2); ctx.fill();
          // corrente / braço conector até lateral
          ctx.strokeStyle='rgba(60,30,10,0.72)'; ctx.lineWidth=2.2; ctx.beginPath(); ctx.moveTo(this.x + side*8, this.y+3+bob); ctx.lineTo(sx, sy+3); ctx.stroke();
          ctx.strokeStyle='rgba(255,180,60,0.44)'; ctx.lineWidth=1.3; ctx.beginPath(); ctx.moveTo(this.x + side*8, this.y+3+bob); ctx.lineTo(sx, sy+3); ctx.stroke();
          // base da serra lateral
          ctx.fillStyle='#1a0a0a'; ctx.fillRect(sx-5, sy-1, 10, 4);
          ctx.fillStyle='#2a1a0a'; ctx.fillRect(sx-4, sy, 8, 2);
          // disco serra lateral girando (referência Chainsaw Man)
          ctx.save(); ctx.translate(sx, sy+2); ctx.rotate(sideSpin * (side===1?1:-1));
          ctx.fillStyle='#e8e8e8'; ctx.beginPath(); ctx.arc(0,0, 5.4,0,Math.PI*2); ctx.fill();
          ctx.strokeStyle='#ff3b30'; ctx.lineWidth=1;
          for(let i=0;i<6;i++){ const ang=(i/6)*Math.PI*2; ctx.beginPath(); ctx.moveTo(Math.cos(ang)*2.4, Math.sin(ang)*2.4); ctx.lineTo(Math.cos(ang)*6, Math.sin(ang)*6); ctx.stroke(); }
          ctx.fillStyle='#1a0a0a'; ctx.beginPath(); ctx.arc(0,0, 1.9,0,Math.PI*2); ctx.fill();
          // dente brilhante
          ctx.fillStyle='rgba(255,255,255,0.92)'; ctx.beginPath(); ctx.arc(2, -1, 0.8,0,Math.PI*2); ctx.fill();
          ctx.restore();
          // brilho lateral
          ctx.fillStyle='rgba(255,180,60,0.20)'; ctx.beginPath(); ctx.arc(sx, sy+2, 8.5,0,Math.PI*2); ctx.fill();
          if(Math.random()<0.14){ ctx.fillStyle='#ff8c42'; ctx.fillRect(sx+randRange(-2,2), sy+6, 1.2,1.2); }
        }
        ctx.fillStyle='#ff6a00'; ctx.font='bold 5px monospace'; ctx.textAlign='center';
        ctx.fillText('CHAINSAW MAN', x+12, y+5+bob); ctx.textAlign='left';
        ctx.fillStyle='#ffcc66'; ctx.font='5px monospace'; ctx.textAlign='center'; ctx.fillText('POCHITA x5', x+12, y+7.5+bob); ctx.textAlign='left';
      } else {
        // indicador sem pochita: serra única
        ctx.fillStyle='rgba(255,60,60,0.18)'; ctx.beginPath(); ctx.arc(x+12, y+12+bob, 9,0,Math.PI*2); ctx.fill();
      }
      // melee anim overlay (braço)
      if(this.meleeAnim>0 && this.meleeDir){
        const p=this.meleeAnim/160;
        const ang=Math.atan2(this.meleeDir.y, this.meleeDir.x);
        ctx.strokeStyle='rgba(255,60,60,0.92)'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(x+12, y+12+bob); ctx.lineTo(x+12+Math.cos(ang)*(9+p*8), y+12+bob+Math.sin(ang)*(9+p*8)); ctx.stroke();
      }
      }
    } else if (isRayMatematico) {
      // Dev Raio Matemático - visual ciano energia com núcleo e curtos para inspiração Isaac
      const prog = this.isRayMatematicoCharging ? this.getRayMatematicoProgress() : 0;
      const isReady = prog >= 0.99;
      ctx.fillStyle='#0a4a5e'; ctx.fillRect(x+4, y+9 + bob, 16, 6);
      ctx.fillStyle= isReady ? '#ffffff' : prog>0.6 ? '#7af2ff' : '#1a8fb3';
      ctx.fillRect(x+6, y+11 + bob, 12, 1.8);
      ctx.fillStyle= isReady ? '#b8fffb' : '#e0ffff';
      ctx.fillRect(x+6, y+11 + bob, Math.floor(12*prog), 1.8);
      // núcleo brilhante
      ctx.fillStyle= isReady ? 'rgba(255,255,255,0.95)' : 'rgba(184,255,251,0.65)';
      ctx.fillRect(x+7, y+10 + bob, 2, 1);
      if(this.isRayMatematicoCharging && prog>0.70){
        ctx.fillStyle=`rgba(122,242,255,${0.14+prog*0.20})`;
        ctx.fillRect(x+1, y+6 + bob, 22, 12);
        ctx.fillStyle='rgba(255,255,255,0.22)';
        if(Math.random()<0.35) ctx.fillRect(x+8+randRange(-2,2), y+7+randRange(-1,1)+bob, 1,1);
      }
      if(isReady){
        ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.lineWidth=1; ctx.strokeRect(x+4, y+9 + bob, 16, 6);
        // anel energia pronto
        ctx.strokeStyle='rgba(184,255,251,0.42)'; ctx.lineWidth=1.2;
        ctx.beginPath(); ctx.arc(x+12, y+12+bob, 8+Math.sin(this.animTime*0.015)*1.2,0,Math.PI*2); ctx.stroke();
      }
      // Sobremesa ativa indica ponto laranja
      if(this.hasSobremesa()){
        ctx.fillStyle='#ffd8a8'; ctx.fillRect(x+14, y+7 + bob, 2, 2);
        ctx.fillStyle='#ff8c42'; ctx.fillRect(x+14.5, y+7.5 + bob, 1, 1);
      }
      // detalhe cano energia
      ctx.fillStyle='#eef8ff'; ctx.fillRect(x+18, y+11.4 + bob, 3, 1);
    } else if (isBastao) {
      // JG Bastão: visual amarelado, indica se tem bastão ou não
      if(this.characterId==='jg' && !this.hasBastao){
        // sem bastão: cabo vazio + indicador
        ctx.fillStyle='rgba(0,0,0,0.22)';
        ctx.fillRect(x+5, y+11 + bob, 14, 2);
        ctx.strokeStyle='rgba(250,204,21,0.45)';
        ctx.lineWidth=1; ctx.setLineDash([2,2]);
        ctx.strokeRect(x+5, y+11 + bob, 14, 2); ctx.setLineDash([]);
        ctx.fillStyle='rgba(250,204,21,0.85)';
        ctx.font='4px monospace'; ctx.textAlign='center';
        ctx.fillText('SEM BASTÃO', x+12, y+7 + bob); ctx.textAlign='left';
        // linha pontilhada até bastão no ar
        if(this.bastaoProjectile && !this.bastaoProjectile.dead){
          ctx.strokeStyle='rgba(250,204,21,0.28)';
          ctx.lineWidth=1; ctx.setLineDash([3,3]);
          ctx.beginPath(); ctx.moveTo(x+12, y+11 + bob); ctx.lineTo(this.bastaoProjectile.x - this.x + x+12, this.bastaoProjectile.y - this.y + y+11); ctx.stroke(); ctx.setLineDash([]);
        }
      } else {
        // JG com bastão na mão: não desenha flutuante duplicado, só aura sutil (modelo já na mão)
        if(this.isBastaoCharging){
          const prog=this.getBastaoChargeProgress();
          if(prog>0.35){
            ctx.fillStyle=`rgba(250,204,21,${0.10+prog*0.18})`;
            ctx.beginPath(); ctx.arc(x+12, y+12+bob, 8+prog*4, 0, Math.PI*2); ctx.fill();
          }
          if(prog>=0.99 && Math.floor(this.animTime/80)%2===0){
            ctx.fillStyle='rgba(255,255,255,0.85)';
            ctx.fillRect(x+8, y+9 + bob, 6,1);
          }
        } else {
          ctx.fillStyle='rgba(250,204,21,0.08)'; ctx.beginPath(); ctx.arc(x+12, y+12+bob, 7,0,Math.PI*2); ctx.fill();
        }
      }
    } else if (this.weapon.name==='NORMAL' && this.hasDoubleShot){
      // indica tiro duplo com dois canos
      ctx.fillStyle='#1a1a1a';
      ctx.fillRect(x+6, y+10 + bob, 12, 1);
      ctx.fillRect(x+6, y+14 + bob, 12, 1);
    }

    if (this.hasFlameTrail) {
      ctx.fillStyle='rgba(255,80,0,0.9)';
      ctx.fillRect(x+9, y-4 + bob, 6, 3);
      ctx.fillStyle='#ffcc00';
      ctx.fillRect(x+10, y-3 + bob, 4, 1);
    }
    if(this.characterId==='kinight'){
      // Gauntletes metálicos
      ctx.fillStyle='#a8c8e0';
      ctx.fillRect(x, y+10 + bob, 4, 6);
      ctx.fillRect(x+20, y+10 + bob, 4, 6);
      ctx.fillStyle='#7a9ab8';
      ctx.fillRect(x, y+12 + bob, 4, 2);
      ctx.fillRect(x+20, y+12 + bob, 4, 2);
      ctx.fillStyle='#4a6b8a';
      ctx.fillRect(x+1, y+11 + bob, 2, 1);
      ctx.fillRect(x+21, y+11 + bob, 2, 1);
      // Elmo fechado - Kinight com armadura
      ctx.fillStyle='#b8d0e8';
      ctx.fillRect(x+5, y+1 + bob, 14, 11);
      ctx.fillStyle='#8fb8d8';
      ctx.fillRect(x+5, y+1 + bob, 14, 4);
      // viseira escura
      ctx.fillStyle='#1a2a3a';
      ctx.fillRect(x+6, y+5 + bob, 12, 3);
      // fenda da viseira brilhante
      ctx.fillStyle='#00e5ff';
      const eyeYk = y+6 + bob;
      ctx.fillRect(x+8, eyeYk, 3, 1);
      ctx.fillRect(x+13, eyeYk, 3, 1);
      ctx.fillStyle='#ffffff';
      ctx.fillRect(x+9, eyeYk, 1, 1);
      ctx.fillRect(x+14, eyeYk, 1, 1);
      // detalhe elmo - crista
      ctx.fillStyle='#ffd700';
      ctx.fillRect(x+11, y+0 + bob, 2, 3);
      ctx.fillStyle='#a8c8e0';
      ctx.fillRect(x+5, y+1 + bob, 1, 8);
      ctx.fillRect(x+18, y+1 + bob, 1, 8);
    } else if(this.characterId==='jg'){
      // JG: casaco cinza + camisa amarela que muda ao lançar + calça azul escuro + sem boné
      // ---- Pernas / calça azul escuro ----
      ctx.fillStyle='#1e3a5f'; // azul escuro calça
      ctx.fillRect(x+7, y+16+bob, 10, 5);
      ctx.fillStyle='#0f2a44'; // sombra calça
      ctx.fillRect(x+7, y+19+bob, 10,1);
      // tênis / sapatos escuros simples
      ctx.fillStyle='#0f172a'; ctx.fillRect(x+6, y+20+bob, 5,2); ctx.fillRect(x+13, y+20+bob,5,2);
      ctx.fillStyle='#1e293b'; ctx.fillRect(x+6, y+20+bob, 5,0.8); ctx.fillRect(x+13, y+20+bob,5,0.8);
      // ---- Casaco cinza aberto ----
      ctx.fillStyle='#6b7280'; // cinza casaco
      ctx.fillRect(x+4, y+9+bob, 16, 10);
      // lapela do casaco
      ctx.fillStyle='#9ca3af'; ctx.fillRect(x+4, y+9+bob, 2,10); ctx.fillRect(x+18, y+9+bob, 2,10);
      ctx.fillStyle='#4b5563'; ctx.fillRect(x+6, y+9+bob, 1,10); ctx.fillRect(x+17, y+9+bob,1,10);
      // ---- Camisa amarela por baixo (muda ao lançar) ----
      const jgShirtPulse = this.isBastaoCharging ? this.getBastaoChargeProgress() : 0;
      const jgIsThrowing = !this.hasBastao || this.isBastaoCharging;
      let shirtCol = '#facc15';
      if(jgIsThrowing){
        if(this.isBastaoCharging && jgShirtPulse>0.6) shirtCol = jgShirtPulse>0.85 ? '#ffffff' : '#ffedd5';
        else if(!this.hasBastao) shirtCol = '#ff8c42'; // laranja quando bastão lançado
        else shirtCol = '#fde68a';
      }
      ctx.fillStyle=shirtCol;
      ctx.fillRect(x+8, y+11+bob, 8, 6);
      // botões da camisa
      ctx.fillStyle='#1a1a1a'; ctx.fillRect(x+11, y+12+bob,1,1); ctx.fillRect(x+11, y+14+bob,1,1);
      // ---- Mãos / bastão ----
      ctx.fillStyle = '#e8c9a0';
      ctx.fillRect(x, y+10 + bob, 4, 6); // mão esquerda
      if(this.hasBastao){
        ctx.fillStyle='#3a2e00';
        ctx.fillRect(x+18, y+8 + bob, 7, 9);
        ctx.fillStyle='#4a3d0a';
        ctx.fillRect(x+19, y+9 + bob, 5, 7);
        const isChargingJg = this.isBastaoCharging;
        const progJg = isChargingJg ? this.getBastaoChargeProgress() : 0;
        const vibJg = isChargingJg ? (Math.random()-0.5)*1.2 : 0;
        ctx.fillStyle= isChargingJg && progJg>0.85 ? '#ffffff' : isChargingJg && progJg>0.5 ? '#fde68a' : '#facc15';
        ctx.fillRect(x+17+vibJg, y+11 + bob, 14, 2.8);
        ctx.fillStyle='#fffbeb';
        ctx.fillRect(x+18+vibJg, y+11.4 + bob, 12, 1);
        ctx.fillStyle='#1a1500';
        ctx.fillRect(x+17+vibJg, y+11 + bob, 2, 2.8);
        ctx.fillRect(x+29+vibJg, y+11 + bob, 2, 2.8);
        if(isChargingJg && progJg>0.85 && Math.random()<0.32){
          ctx.fillStyle='#fff';
          ctx.fillRect(x+30+vibJg, y+11.5+bob, 2, 1.2);
        }
      } else {
        ctx.fillStyle='#e8c9a0';
        ctx.fillRect(x+18, y+10 + bob, 5, 5);
      }
      // ---- Cabeça JG - SEM BONÉ, cabelo escuro ----
      ctx.fillStyle='#e8c9a0'; // pele
      ctx.fillRect(x+5, y+1 + bob, 14, 11);
      // cabelo castanho escuro (topo e laterais) - sem boné
      ctx.fillStyle='#1a1a1a';
      ctx.fillRect(x+5, y+1 + bob, 14, 3.5);
      ctx.fillStyle='#2a1a0f';
      ctx.fillRect(x+5, y+1 + bob, 14, 2);
      ctx.fillStyle='#1a1a1a';
      ctx.fillRect(x+4, y+3 + bob, 2, 5);
      ctx.fillRect(x+18, y+3 + bob, 2, 5);
      // franja
      ctx.fillStyle='#0f0f0f';
      ctx.fillRect(x+6, y+3 + bob, 12, 1);
      const eyeYjg2 = y+6 + bob;
      ctx.fillStyle='#1a1a1a';
      ctx.fillRect(x+8, eyeYjg2, 2.5, 2.5);
      ctx.fillRect(x+13, eyeYjg2, 2.5, 2.5);
      ctx.fillStyle='#ff6b35';
      ctx.fillRect(x+8.5, eyeYjg2+0.5, 1, 1);
      ctx.fillRect(x+13.5, eyeYjg2+0.5, 1, 1);
      ctx.fillStyle='#fff';
      ctx.fillRect(x+8.5, eyeYjg2, 1, 1);
      ctx.fillRect(x+13.5, eyeYjg2, 1, 1);
      ctx.fillStyle='#7a1a1a';
      ctx.fillRect(x+10, y+9 + bob, 4, 1.2);
      ctx.fillStyle='#fff';
      ctx.fillRect(x+11, y+9 + bob, 2, 0.8);
      ctx.fillStyle='rgba(255,107,107,0.28)';
      ctx.fillRect(x+6, y+8 + bob, 2, 1);
      ctx.fillRect(x+16, y+8 + bob, 2, 1);
    } else if(this.characterId==='jl'){
      // JL - Visual exclusivo: Hoodie preto/rosa neon com 67, óculos e tênis farmar - identidade premium
      // pernas / calça street escura com faixa neon
      ctx.fillStyle='#0d0d10'; ctx.fillRect(x+7, y+16+bob, 10, 5);
      ctx.fillStyle='#ff6b9d'; ctx.fillRect(x+7, y+18+bob, 10, 1.2);
      // tênis neon estiloso rosa
      ctx.fillStyle='#ff8fbc'; ctx.fillRect(x+6, y+20+bob, 5, 2.4);
      ctx.fillRect(x+13, y+20+bob, 5, 2.4);
      ctx.fillStyle='#fff'; ctx.fillRect(x+6, y+21+bob, 5, 0.8);
      ctx.fillRect(x+13, y+21+bob, 5, 0.8);
      ctx.fillStyle='rgba(255,107,157,0.85)'; ctx.fillRect(x+7, y+22+bob, 3, 0.8);
      ctx.fillRect(x+14, y+22+bob, 3, 0.8);
      // hoodie corpo - base preta com detalhes neon rosa
      ctx.fillStyle='#13131a'; ctx.fillRect(x+5, y+9+bob, 14, 10);
      ctx.fillStyle='#1a1220'; ctx.fillRect(x+5, y+9+bob, 14, 3);
      ctx.fillStyle='#ff6b9d'; ctx.fillRect(x+5, y+9+bob, 14, 1.2);
      ctx.fillStyle='#1f1020'; ctx.fillRect(x+9, y+12+bob, 6, 5);
      // 67 peito neon pulsante
      const jlPulse = 0.5+Math.sin(this.animTime*0.018)*0.32;
      ctx.fillStyle = this.farmarAuraActive ? '#fff' : `rgba(255,107,157,${0.92+jlPulse*0.08})`;
      ctx.font='bold 7px "Press Start 2P"'; ctx.textAlign='center';
      ctx.fillText('67', x+12, y+16+bob);
      // glow sutil 67 quando idle
      if(!this.farmarAuraActive && jlPulse>0.7){
        ctx.fillStyle='rgba(255,107,157,0.18)'; ctx.beginPath(); ctx.arc(x+12, y+13.5+bob, 7+jlPulse*1.5, 0, Math.PI*2); ctx.fill();
      }
      ctx.textAlign='left';
      // braços hoodie com faixa neon
      ctx.fillStyle='#13131a'; ctx.fillRect(x+2, y+10+bob, 4, 6);
      ctx.fillRect(x+18, y+10+bob, 4, 6);
      ctx.fillStyle='#ff6b9d'; ctx.fillRect(x+2, y+12+bob, 4,1.2);
      ctx.fillRect(x+18, y+12+bob, 4,1.2);
      ctx.fillStyle='#2a1430'; ctx.fillRect(x+2, y+15+bob, 4,1);
      ctx.fillRect(x+18, y+15+bob, 4,1);
      // cabeça com capuz hood rosa
      ctx.fillStyle='#ff6b9d'; ctx.fillRect(x+4, y+0+bob, 16, 11);
      ctx.fillStyle='#0f0f14'; ctx.fillRect(x+5, y+1+bob, 14, 9);
      // rosto
      ctx.fillStyle='#ffdbb0'; ctx.fillRect(x+7, y+4+bob, 10, 7);
      // óculos escuros estiloso JL - marca registrada
      ctx.fillStyle='#080810'; ctx.fillRect(x+7, y+6+bob, 10, 3.2);
      ctx.fillStyle='#ff6b9d'; ctx.fillRect(x+8, y+7+bob, 3,1.2);
      ctx.fillRect(x+13, y+7+bob, 3,1.2);
      ctx.fillStyle='rgba(255,182,193,0.95)'; ctx.fillRect(x+8, y+6.5+bob, 3,0.6);
      ctx.fillRect(x+13, y+6.5+bob, 3,0.6);
      // brilho lente
      ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.fillRect(x+9, y+7+bob, 1,0.7);
      ctx.fillRect(x+14, y+7+bob, 1,0.7);
      // sorriso confiante JL
      ctx.fillStyle='#2a0f18'; ctx.fillRect(x+11, y+10+bob, 2,0.9);
      ctx.fillStyle='#ff8fbc'; ctx.fillRect(x+10, y+11+bob, 4,0.6);
      // sombra capuz
      ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.fillRect(x+5, y+1+bob, 2, 8);
      ctx.fillRect(x+17, y+1+bob, 2, 8);
    } else if(this.characterId==='oli'){
      // Oli - rei humano simples e limpo (pele escurecida)
      ctx.fillStyle='rgba(0,0,0,0.24)'; ctx.fillRect(x+4, y+this.h-3, this.w-4,2);
      ctx.fillStyle='#1e1030'; ctx.fillRect(x+7, y+16+bob, 10,4);
      ctx.fillStyle='#4c1d95'; ctx.fillRect(x+6, y+20+bob, 5,1.8); ctx.fillRect(x+13, y+20+bob,5,1.8);
      ctx.fillStyle='#3b0f6e'; ctx.fillRect(x+5, y+9+bob, 14,9);
      ctx.fillStyle='#ffd700'; ctx.fillRect(x+5, y+9+bob, 14,1);
      ctx.fillStyle='#f0f0ff'; ctx.fillRect(x+5, y+9+bob, 14,2);
      ctx.fillStyle='#c99b6e'; ctx.fillRect(x+7, y+2+bob, 10,8);
      ctx.fillStyle='#1a0a2e'; ctx.fillRect(x+8, y+6+bob, 2,2); ctx.fillRect(x+14, y+6+bob,2,2);
      ctx.fillStyle='#ffd700'; ctx.fillRect(x+7, y+0+bob, 10,2.5);
      ctx.fillStyle='#ff2d55'; ctx.beginPath(); ctx.arc(x+12, y+1.2+bob, 1,0,Math.PI*2); ctx.fill();
    } else if(this.characterId==='ash'){
      // Ash: motosserra no lugar da mão direita (modelo)
      ctx.fillStyle = '#e8c9a0';
      ctx.fillRect(x, y+10 + bob, 4, 6); // mão esquerda normal
      // antebraço direito metálico com motosserra acoplada
      ctx.fillStyle='#2a2a2e';
      ctx.fillRect(x+18, y+8 + bob, 7, 9);
      ctx.fillStyle='#3a3a3a';
      ctx.fillRect(x+19, y+9 + bob, 5, 7);
      const isActiveAsh = this.motosserraActive;
      const spinAsh = this.animTime*0.045 * (isActiveAsh?1.9:0.7);
      const vibAsh = isActiveAsh ? (Math.random()-0.5)*1.4 : 0;
      // corpo serra na mão
      ctx.fillStyle=isActiveAsh ? '#ff3b30' : '#b91c1c';
      ctx.fillRect(x+18+vibAsh, y+11 + bob, 8, 3.2);
      ctx.fillStyle='#0f0f0f';
      ctx.fillRect(x+20+vibAsh, y+10 + bob, 4, 1);
      ctx.fillRect(x+20+vibAsh, y+13.5 + bob, 4, 1);
      // disco serra
      ctx.save();
      ctx.translate(x+23+vibAsh, y+12.6+bob);
      ctx.rotate(spinAsh);
      ctx.fillStyle='#e6e6e6';
      ctx.beginPath(); ctx.arc(0,0, 4.2, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle=isActiveAsh ? '#ff2a1a' : '#8a8a8a';
      ctx.lineWidth=0.9;
      for(let i=0;i<6;i++){ const ang=(i/6)*Math.PI*2; ctx.beginPath(); ctx.moveTo(Math.cos(ang)*1.7, Math.sin(ang)*1.7); ctx.lineTo(Math.cos(ang)*4.4, Math.sin(ang)*4.4); ctx.stroke(); }
      ctx.fillStyle='#0a0a0a'; ctx.beginPath(); ctx.arc(0,0, 1.4, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      if(isActiveAsh){
        ctx.fillStyle='rgba(255,60,60,0.26)';
        ctx.beginPath(); ctx.arc(x+23, y+12.6+bob, 6.5, 0, Math.PI*2); ctx.fill();
        if(Math.random()<0.42){
          ctx.fillStyle='#ff8c42';
          ctx.fillRect(x+22+ (Math.random()-0.5)*5, y+12+bob + (Math.random()-0.5)*5, 1.6, 1.6);
        }
      }
      if(this.weapon && this.weapon.hasPochita){
        ctx.fillStyle='#ffb347';
        ctx.beginPath(); ctx.arc(x+18, y+10+bob, 1.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x+24, y+13+bob, 1.5, 0, Math.PI*2); ctx.fill();
      }
      // Cabeça Ash - visual único: cabelo escuro com mecha vermelha, cicatriz, olhar intenso
      ctx.fillStyle='#f0c9a0';
      ctx.fillRect(x+5, y+1 + bob, 14, 11);
      // cabelo Ash
      ctx.fillStyle='#1a0a0a';
      ctx.fillRect(x+5, y+1 + bob, 14, 6);
      ctx.fillStyle='#2a2a2a';
      ctx.fillRect(x+6, y+2 + bob, 12, 3);
      ctx.fillStyle='#ff3b30';
      ctx.fillRect(x+9, y+1 + bob, 6, 2); // mecha vermelha topo
      ctx.fillStyle='#3a1a0a';
      ctx.fillRect(x+4, y+3 + bob, 2, 5);
      // olhos Ash
      ctx.fillStyle='#1a0000';
      const eyeYAsh = y+6 + bob;
      if(this.facing===1){
        ctx.fillRect(x+9, eyeYAsh, 3, 2.5);
        ctx.fillRect(x+14, eyeYAsh, 3, 2.5);
        ctx.fillStyle='#ff3b30';
        ctx.fillRect(x+9.5, eyeYAsh+0.5, 2, 1.2);
        ctx.fillRect(x+14.5, eyeYAsh+0.5, 2, 1.2);
        ctx.fillStyle='#fff';
        ctx.fillRect(x+10, eyeYAsh, 1, 1);
        ctx.fillRect(x+15, eyeYAsh, 1, 1);
      } else {
        ctx.fillRect(x+7, eyeYAsh, 3, 2.5);
        ctx.fillRect(x+12, eyeYAsh, 3, 2.5);
        ctx.fillStyle='#ff3b30';
        ctx.fillRect(x+7.5, eyeYAsh+0.5, 2, 1.2);
        ctx.fillRect(x+12.5, eyeYAsh+0.5, 2, 1.2);
        ctx.fillStyle='#fff';
        ctx.fillRect(x+8, eyeYAsh, 1, 1);
        ctx.fillRect(x+13, eyeYAsh, 1, 1);
      }
      // cicatriz
      ctx.fillStyle='#7a1a1a';
      ctx.fillRect(x+6, y+8 + bob, 3, 1);
      // boca Ash - séria com dente
      ctx.fillStyle='#5a1a1a';
      ctx.fillRect(x+10, y+10 + bob, 4, 1);
      ctx.fillStyle='#1a0000';
      ctx.fillRect(x+11, y+11 + bob, 2, 1);
      // brinco/piercing
      ctx.fillStyle='#c0c0c0';
      ctx.fillRect(x+4, y+8 + bob, 1, 1);
    } else if(this.characterId==='dev'){
      // Dev - cabeça com óculos programador/cientista + cabelo castanho organizado
      ctx.fillStyle='#ffe4c4'; // pele clara
      ctx.fillRect(x+5, y+1 + bob, 14, 11);
      // cabelo castanho médio programador (penteado organizado)
      ctx.fillStyle='#3d2b1f';
      ctx.fillRect(x+5, y+1 + bob, 14, 4);
      ctx.fillStyle='#5a3d2b';
      ctx.fillRect(x+5, y+1 + bob, 14, 2.2);
      ctx.fillStyle='#2a1a0f';
      ctx.fillRect(x+4, y+3 + bob, 2, 5);
      ctx.fillRect(x+18, y+3 + bob, 2, 5);
      // franja lateral
      ctx.fillStyle='#4a3320';
      ctx.fillRect(x+6, y+3 + bob, 11, 1);
      // óculos retangulares (marca registrada Dev)
      const eyeYDev = y+6 + bob;
      // armação óculos
      ctx.fillStyle='#1a1a1a';
      ctx.fillRect(x+6, eyeYDev-0.5, 7, 4); // lente esquerda
      ctx.fillRect(x+11, eyeYDev+0.8, 2, 0.8); // ponte
      ctx.fillRect(x+13, eyeYDev-0.5, 7, 4); // lente direita
      // lentes ciano claro translúcido (reflexo programador)
      ctx.fillStyle='rgba(122,242,255,0.32)';
      ctx.fillRect(x+6.7, eyeYDev+0.2, 5.6, 2.6);
      ctx.fillRect(x+13.7, eyeYDev+0.2, 5.6, 2.6);
      // olhos atrás dos óculos
      ctx.fillStyle='#0f172a';
      if(this.facing===1){
        ctx.fillRect(x+8.5, eyeYDev+0.8, 2, 1.4);
        ctx.fillRect(x+15.5, eyeYDev+0.8, 2, 1.4);
        ctx.fillStyle='#ffffff';
        ctx.fillRect(x+9, eyeYDev+0.8, 0.8, 0.8);
        ctx.fillRect(x+16, eyeYDev+0.8, 0.8, 0.8);
      } else {
        ctx.fillRect(x+7.5, eyeYDev+0.8, 2, 1.4);
        ctx.fillRect(x+14.5, eyeYDev+0.8, 2, 1.4);
        ctx.fillStyle='#ffffff';
        ctx.fillRect(x+8, eyeYDev+0.8, 0.8, 0.8);
        ctx.fillRect(x+15, eyeYDev+0.8, 0.8, 0.8);
      }
      // reflexo lente (brilho superior)
      ctx.fillStyle='rgba(255,255,255,0.85)';
      ctx.fillRect(x+7.5, eyeYDev, 2, 0.6);
      ctx.fillRect(x+14.5, eyeYDev, 2, 0.6);
      // hastes óculos (lateral)
      ctx.fillStyle='#1a1a1a';
      ctx.fillRect(x+4, eyeYDev+0.5, 2, 0.6);
      ctx.fillRect(x+20, eyeYDev+0.5, 2, 0.6);
      // nariz pequeno
      ctx.fillStyle='#e8b895';
      ctx.fillRect(x+11.5, eyeYDev+2.6, 1.2, 1);
      // boca neutra/sorriso leve programador
      ctx.fillStyle='#7a4a3a';
      ctx.fillRect(x+10, y+10 + bob, 4, 0.9);
      // sardas leves (cientista jovem)
      ctx.fillStyle='rgba(180,120,80,0.28)';
      ctx.fillRect(x+8, y+8.2 + bob, 1, 0.6);
      ctx.fillRect(x+16, y+8.2 + bob, 1, 0.6);
      // mãos dev (luvas? não, mãos pele)
      ctx.fillStyle='#ffe4c4';
      ctx.fillRect(x, y+10 + bob, 4, 5);
      ctx.fillRect(x+20, y+10 + bob, 4, 5);
    } else {
      ctx.fillStyle = '#e8c9a0';
      ctx.fillRect(x, y+10 + bob, 4, 6);
      ctx.fillRect(x+20, y+10 + bob, 4, 6);
      ctx.fillStyle = '#f0d0a0';
      ctx.fillRect(x+5, y+1 + bob, 14, 11);
      ctx.fillStyle = '#6b3f1d';
      ctx.fillRect(x+5, y+1 + bob, 14, 4);
      ctx.fillRect(x+4, y+3 + bob, 3, 6);
      ctx.fillStyle = '#1a1a2e';
      const eyeY = y+6 + bob;
      if (this.facing === 1) {
        ctx.fillRect(x+9, eyeY, 3, 3);
        ctx.fillRect(x+15, eyeY, 3, 3);
        ctx.fillStyle = '#fff';
        ctx.fillRect(x+10, eyeY, 1, 1);
        ctx.fillRect(x+16, eyeY, 1, 1);
      } else {
        ctx.fillRect(x+7, eyeY, 3, 3);
        ctx.fillRect(x+13, eyeY, 3, 3);
        ctx.fillStyle = '#fff';
        ctx.fillRect(x+8, eyeY, 1, 1);
        ctx.fillRect(x+14, eyeY, 1, 1);
      }
      ctx.fillStyle = '#c47a6a';
      ctx.fillRect(x+11, y+6 + bob +4, 2, 1);
    }
    if (this.dashCooldown <= 0 && !this.isCharging && !this.isSwordCharging && !this.isRayMatematicoCharging) {
      ctx.fillStyle = 'rgba(0,217,255,0.9)';
      ctx.fillRect(x+8, y-6 + bob, 8, 3);
    }
    // overlay melee swing (braço esticado durante corte)
    if(this.meleeAnim>0 && this.meleeDir){
      const p=this.meleeAnim/160;
      const ang=Math.atan2(this.meleeDir.y, this.meleeDir.x);
      ctx.strokeStyle='rgba(255,255,255,0.92)';
      ctx.lineWidth=2.2;
      ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(x+12, y+12+bob); ctx.lineTo(x+12+Math.cos(ang)*(11+p*7), y+12+bob+Math.sin(ang)*(11+p*7)); ctx.stroke();
      const tx=x+12+Math.cos(ang)*(14+p*6), ty=y+12+bob+Math.sin(ang)*(14+p*6);
      ctx.fillStyle='rgba(255,255,255,0.88)'; ctx.beginPath(); ctx.arc(tx,ty,1.9,0,Math.PI*2); ctx.fill();
      ctx.lineCap='butt';
    }
    // barra de carregamento visual sobre o jogador - DEV Raio Matemático (gate 100% + Sobremesa marcas)
    if(this.isRayMatematicoCharging){
      const prog = this.getRayMatematicoProgress();
      const bw = 26, bh = 5;
      const bx = x + this.w/2 - bw/2;
      const by = y - 11 + bob;
      ctx.fillStyle='rgba(0,0,0,0.68)'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle='rgba(255,255,255,0.18)'; ctx.fillRect(bx+1, by+1, bw-2, bh-2);
      let fillCol;
      if(prog < 0.35) fillCol = '#0a4a5e';
      else if(prog < 0.70) fillCol = '#1a8fb3';
      else if(prog < 0.95) fillCol = '#7af2ff';
      else fillCol = '#b8fffb';
      if(prog >= 0.99 && Math.floor(this.animTime/85)%2===0) fillCol = '#ffffff';
      ctx.fillStyle = fillCol; ctx.fillRect(bx+1, by+1, (bw-2)*prog, bh-2);
      // marcas de 10% (Sobremesa) - visual claro quanto falta
      ctx.fillStyle='rgba(255,255,255,0.55)';
      for(let i=1;i<10;i++){
        const mx = bx+1 + (bw-2)*(i/10);
        // tick mais forte se já passou (mini já disparado)
        const passed = prog >= i/10;
        ctx.globalAlpha = passed ? 0.85 : 0.32;
        ctx.fillRect(mx, by+1, 1, bh-2);
      }
      ctx.globalAlpha=1;
      // borda quando pronto
      if(prog >= 0.99){
        ctx.strokeStyle='rgba(255,255,255,0.65)'; ctx.lineWidth=1; ctx.strokeRect(bx, by, bw, bh);
        ctx.fillStyle='rgba(184,255,251,0.18)'; ctx.fillRect(bx-2, by-2, bw+4, bh+4);
      } else if(prog > 0.70){
        ctx.strokeStyle='rgba(122,242,255,0.35)'; ctx.lineWidth=1; ctx.strokeRect(bx, by, bw, bh);
      }
      ctx.fillStyle='rgba(255,255,255,0.96)'; ctx.font='5px monospace'; ctx.textAlign='center';
      if(prog >= 0.99) ctx.fillText('PRONTO! SOLTE!', this.x, by-3);
      else ctx.fillText(Math.round(prog*100)+'%', this.x, by-3);
      ctx.textAlign='left';
      if(prog > 0.45 && Math.random()<0.35){
        ctx.fillStyle = prog>0.90 ? '#ffffff' : '#7af2ff';
        const px=this.x+randRange(-10,10), py=y+randRange(-6,2)+bob;
        ctx.fillRect(px, py, 1,1);
      }
      // mini indicadores sob barra quando Sobremesa ativa
      if(this.hasSobremesa()){
        ctx.fillStyle='rgba(255,216,168,0.95)'; ctx.font='4px monospace'; ctx.textAlign='center';
        const cnt = this.rayMatematicoFiredThresholds ? this.rayMatematicoFiredThresholds.size : 0;
        ctx.fillText(`🧁 ${cnt}/10`, this.x, by+bh+7); ctx.textAlign='left';
      }
    }
    // barra de carregamento visual sobre o jogador (enquanto segura) - CARREGADA
    if(this.isCharging){
      const prog = this.getChargeProgress();
      const bw = 24, bh = 4;
      const bx = x + this.w/2 - bw/2;
      const by = y - 10 + bob;
      // fundo
      ctx.fillStyle='rgba(0,0,0,0.65)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle='rgba(255,255,255,0.18)';
      ctx.fillRect(bx+1, by+1, bw-2, bh-2);
      // preenchimento gradativo roxo -> branco quando cheio
      let fillCol;
      if(prog < 0.45) fillCol = '#7c3aed';
      else if(prog < 0.85) fillCol = '#a78bfa';
      else fillCol = '#e9d5ff';
      // flash quando no máximo
      if(prog >= 0.99 && Math.floor(this.animTime/70)%2===0) fillCol = '#ffffff';
      ctx.fillStyle = fillCol;
      ctx.fillRect(bx+1, by+1, (bw-2)*prog, bh-2);
      // borda brilhante quando alta carga
      if(prog > 0.85){
        ctx.strokeStyle='rgba(255,255,255,0.55)';
        ctx.lineWidth=1;
        ctx.strokeRect(bx, by, bw, bh);
      }
      // indicador de dano acima da barra
      ctx.fillStyle='rgba(255,255,255,0.9)';
      ctx.font='5px monospace';
      ctx.textAlign='center';
      const dmg = this.getChargeDamage();
      ctx.fillText(dmg.toFixed(1)+'x', this.x, by -2);
      ctx.textAlign='left';
      // partículas ao redor quando alta carga
      if(prog > 0.6 && Math.random() < 0.4){
        ctx.fillStyle = prog > 0.85 ? '#ffffff' : '#a78bfa';
        const px = this.x + randRange(-10,10);
        const py = y + randRange(-6, 2) + bob;
        ctx.fillRect(px, py, 1, 1);
      }
    }
    // espada carga pesada - barra prateada
    if(this.isSwordCharging){
      const prog=this.getSwordChargeProgress();
      const bw=22, bh=4;
      const bx=x+this.w/2 - bw/2;
      const by=y -10 + bob;
      ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(bx,by,bw,bh);
      ctx.fillStyle='rgba(255,255,255,0.18)'; ctx.fillRect(bx+1,by+1,bw-2,bh-2);
      let fillCol;
      if(prog<0.5) fillCol='#a0a0a0';
      else if(prog<0.92) fillCol='#e8e8e8';
      else fillCol='#ffffff';
      if(prog>=0.99 && Math.floor(this.animTime/70)%2===0) fillCol='#ffd700';
      ctx.fillStyle=fillCol; ctx.fillRect(bx+1,by+1,(bw-2)*prog,bh-2);
      if(prog>0.85){ ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.lineWidth=1; ctx.strokeRect(bx,by,bw,bh); }
      ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.font='5px monospace'; ctx.textAlign='center';
      ctx.fillText(prog>=0.99?'PESADO!':'carregando...', this.x, by-2); ctx.textAlign='left';
      if(prog>0.6 && Math.random()<0.35){
        ctx.fillStyle=prog>0.85?'#ffffff':'#d0d0d8';
        const px=this.x + randRange(-9,9);
        const py=y + randRange(-5,2)+bob;
        ctx.fillRect(px,py,1,1);
      }
    }
    // JG Bastão - barra amarela de carga para arremesso
    if(this.isBastaoCharging && this.characterId==='jg'){
      const prog=this.getBastaoChargeProgress();
      const bw=22, bh=4;
      const bx=x+this.w/2 - bw/2;
      const by=y -10 + bob;
      ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(bx,by,bw,bh);
      ctx.fillStyle='rgba(255,255,255,0.18)'; ctx.fillRect(bx+1,by+1,bw-2,bh-2);
      let fillCol;
      if(prog<0.5) fillCol='#facc15';
      else if(prog<0.92) fillCol='#fde68a';
      else fillCol='#ffffff';
      if(prog>=0.99 && Math.floor(this.animTime/70)%2===0) fillCol='#fffbeb';
      ctx.fillStyle=fillCol; ctx.fillRect(bx+1,by+1,(bw-2)*prog,bh-2);
      if(prog>0.85){ ctx.strokeStyle='rgba(250,204,21,0.55)'; ctx.lineWidth=1; ctx.strokeRect(bx,by,bw,bh); }
      ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.font='5px monospace'; ctx.textAlign='center';
      ctx.fillText(prog>=0.99?'ARREMESSO!':'carregando bastão...', this.x, by-2); ctx.textAlign='left';
      if(prog>0.6 && Math.random()<0.35){
        ctx.fillStyle=prog>0.85?'#ffffff':'#facc15';
        const px=this.x + randRange(-9,9);
        const py=y + randRange(-5,2)+bob;
        ctx.fillRect(px,py,1,1);
      }
    }
    // LUVA - barra de carga sobre jogador (enquanto segura)
    if(this.weapon && this.weapon.isLuva && (this.luvaIsCharging || this.luvaCharge>0)){
      const pct = clamp(this.luvaCharge/this.luvaChargeMax,0,1);
      const bw=24, bh=4;
      const bx=x+this.w/2 - bw/2;
      const by=y-10+bob;
      ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(bx,by,bw,bh);
      ctx.fillStyle='rgba(255,255,255,0.18)'; ctx.fillRect(bx+1,by+1,bw-2,bh-2);
      let fillCol;
      if(pct>=0.995) fillCol='#ffd700';
      else if(pct>0.6) fillCol='#ff8c42';
      else fillCol='#ff3b30';
      if(pct>=0.995 && Math.floor(this.animTime/90)%2===0) fillCol='#ffffff';
      ctx.fillStyle=fillCol; ctx.fillRect(bx+1,by+1,(bw-2)*pct,bh-2);
      if(pct>0.85){ ctx.strokeStyle='rgba(255,215,0,0.55)'; ctx.lineWidth=1; ctx.strokeRect(bx,by,bw,bh); }
      ctx.fillStyle='rgba(255,255,255,0.92)'; ctx.font='5px monospace'; ctx.textAlign='center';
      ctx.fillText(pct>=0.995?'FOGUETE!':'LUVA '+Math.round(pct*100)+'%', this.x, by-2); ctx.textAlign='left';
    }
    // ===== Personagem - indicador de identidade e status =====
    if(this.characterId){
      // faixa de nome acima do jogador
      const col = this.characterColor || '#fff';
      const icon = this.characterIcon || '?';
      // JG: mostra se tem bastão ou não + velocidade
      if(this.characterId==='kinight'){
        const pulse = 0.5+Math.sin(this.animTime*0.012)*0.28;
        ctx.fillStyle=`rgba(96,165,250,${0.12+pulse*0.07})`;
        ctx.beginPath(); ctx.arc(this.x, this.y+bob, 17+pulse*2,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle=`rgba(96,165,250,${0.32+pulse*0.15})`; ctx.lineWidth=1.2;
        ctx.beginPath(); ctx.arc(this.x, this.y+bob, 13,0,Math.PI*2); ctx.stroke();
        // nome do personagem removido em cima durante o jogo
        ctx.fillStyle='rgba(255,255,255,0.72)'; ctx.font='5px monospace'; ctx.textAlign='center';
        ctx.fillText('SÓ ESPADA', this.x, y-16 + bob); ctx.textAlign='left';
      } else if(this.characterId==='jl'){
        if(this.farmarAuraActive){
          const pulse = 0.62+Math.sin(this.animTime*0.018)*0.32;
          const r = this.farmarAuraRadius || FARMAR_AURA_RADIUS;
          const t = this.animTime*0.0045;
          // camada externa ultra suave - brilho ambiente
          ctx.fillStyle=`rgba(255,107,157,${0.10+Math.sin(this.animTime*0.011)*0.04})`;
          ctx.beginPath(); ctx.arc(this.x, this.y+bob, r*1.18,0,Math.PI*2); ctx.fill();
          // fill principal com energia pulsante
          ctx.fillStyle=`rgba(255,107,157,${0.18+pulse*0.09})`;
          ctx.beginPath(); ctx.arc(this.x, this.y+bob, r,0,Math.PI*2); ctx.fill();
          // anel externo neon vibrante
          ctx.strokeStyle=`rgba(255,107,157,${0.52+pulse*0.18})`;
          ctx.lineWidth=2.8;
          ctx.beginPath(); ctx.arc(this.x, this.y+bob, r,0,Math.PI*2); ctx.stroke();
          // anel interno tracejado energizado
          ctx.strokeStyle=`rgba(255,182,193,${0.32+pulse*0.16})`;
          ctx.lineWidth=1.3; ctx.setLineDash([7,5]);
          ctx.beginPath(); ctx.arc(this.x, this.y+bob, r*0.72,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
          // ticks rotativos externos 12 - efeito eletromagnético
          for(let tik=0;tik<12;tik++){
            const ang=(tik/12)*Math.PI*2 + t*1.18;
            const r1=r*0.94, r2=r*1.07;
            const x1=this.x+Math.cos(ang)*r1, y1=this.y+bob+Math.sin(ang)*r1;
            const x2=this.x+Math.cos(ang)*r2, y2=this.y+bob+Math.sin(ang)*r2;
            ctx.strokeStyle=`rgba(255,107,157,${0.62+Math.sin(tik+this.animTime*0.009)*0.20})`;
            ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
            ctx.fillStyle='rgba(255,255,255,0.96)'; ctx.beginPath(); ctx.arc(x2,y2,1.2,0,Math.PI*2); ctx.fill();
          }
          // setas de empurrão magnéticas com cabeça brilhante
          for(let a=0;a<6;a++){
            const ang=(a/6)*Math.PI*2 + t*1.35;
            const x1=this.x+Math.cos(ang)*r*0.52, y1=this.y+bob+Math.sin(ang)*r*0.52;
            const x2=this.x+Math.cos(ang)*r*0.88, y2=this.y+bob+Math.sin(ang)*r*0.88;
            ctx.strokeStyle=`rgba(255,107,157,${0.68})`;
            ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
            ctx.fillStyle='rgba(255,255,255,0.96)'; ctx.beginPath(); ctx.arc(x2,y2,1.9,0,Math.PI*2); ctx.fill();
            ctx.fillStyle='rgba(255,107,157,0.92)'; ctx.beginPath(); ctx.arc(x2,y2,0.9,0,Math.PI*2); ctx.fill();
          }
          // núcleo central - disco branco rosa para contraste do 67
          ctx.fillStyle='rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.arc(this.x, this.y+bob, 18,0,Math.PI*2); ctx.fill();
          ctx.strokeStyle='rgba(255,255,255,0.22)'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(this.x, this.y+bob, 18,0,Math.PI*2); ctx.stroke();
          // 67 central com brilho e glitch duplo
          ctx.save();
          ctx.shadowColor='#ff6b9d'; ctx.shadowBlur=18;
          ctx.fillStyle='#fff'; ctx.font='bold 11px "Press Start 2P"'; ctx.textAlign='center';
          ctx.fillText('67', this.x, this.y+bob+4);
          ctx.restore();
          if(Math.random()<0.09){
            ctx.fillStyle='rgba(255,107,157,0.45)'; ctx.font='bold 11px "Press Start 2P"'; ctx.textAlign='center';
            ctx.fillText('67', this.x+1.2, this.y+bob+4); ctx.textAlign='left';
            ctx.fillStyle='rgba(96,165,250,0.32)'; ctx.fillText('67', this.x-1.2, this.y+bob+4); ctx.textAlign='left';
          } else ctx.textAlign='left';
          // números orbitais 6 e 7 digitais ao redor núcleo
          for(let o=0;o<4;o++){
            const ang=(o/4)*Math.PI*2 + t*2.6;
            const rx=this.x+Math.cos(ang)*r*0.58, ry=this.y+bob+Math.sin(ang)*r*0.58;
            ctx.fillStyle=o%2? '#ff6b9d':'#fff'; ctx.font='6px monospace'; ctx.textAlign='center';
            ctx.fillText(o%2?'7':'6', rx, ry+2); ctx.textAlign='left';
            ctx.fillStyle='rgba(255,107,157,0.18)'; ctx.beginPath(); ctx.arc(rx,ry,8,0,Math.PI*2); ctx.fill();
          }
        } else {
          const pulse = 0.52+Math.sin(this.animTime*0.014)*0.24;
          // aura idle respirando com camadas - sem indicador textual acima (removido conforme request)
          ctx.fillStyle=`rgba(255,107,157,${0.11+pulse*0.06})`;
          ctx.beginPath(); ctx.arc(this.x, this.y+bob, 17+pulse*2,0,Math.PI*2); ctx.fill();
          ctx.strokeStyle=`rgba(255,107,157,${0.24+pulse*0.14})`; ctx.lineWidth=1.4;
          ctx.beginPath(); ctx.arc(this.x, this.y+bob, 14.5+pulse*1.2,0,Math.PI*2); ctx.stroke();
          ctx.strokeStyle=`rgba(255,255,255,${0.16+pulse*0.08})`; ctx.lineWidth=1; ctx.setLineDash([3,3]);
          ctx.beginPath(); ctx.arc(this.x, this.y+bob, 10.5,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
        }
      } else if(this.characterId==='oli'){
        const pulse=0.5+Math.sin(this.animTime*0.015)*0.20;
        ctx.fillStyle=`rgba(167,139,250,${0.08+pulse*0.04})`;
        ctx.beginPath(); ctx.arc(this.x, this.y+bob, 14+pulse*1.5,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle=`rgba(167,139,250,${0.18+pulse*0.08})`; ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(this.x, this.y+bob, 12,0,Math.PI*2); ctx.stroke();
      } else if(this.characterId==='neutro'){
        const pulse = 0.5+Math.sin(this.animTime*0.011)*0.18;
        ctx.fillStyle=`rgba(209,213,219,${0.10+pulse*0.06})`;
        ctx.beginPath(); ctx.arc(this.x, this.y+bob, 13,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle=`rgba(209,213,219,${0.22+pulse*0.10})`; ctx.lineWidth=1.1;
        ctx.beginPath(); ctx.arc(this.x, this.y+bob, 11,0,Math.PI*2); ctx.stroke();
        // nome Neutro removido em cima durante o jogo
        ctx.fillStyle='#d1d5db'; ctx.font='5px monospace'; ctx.textAlign='center';
        ctx.fillText('EQUILÍBRIO', this.x, y-16 + bob); ctx.textAlign='left';
      }
      // tag pequena com ícone do personagem ao lado do nome da arma (sobreposto na barra)
      // desenha acima da barra de vida no canvas? Já está na HUD, então apenas aura acima já basta
    }
    // ===== Power Star ⭐ - efeito visual invencibilidade =====
    if(this.powerStarActive){
      const pulse = 0.65 + Math.sin(this.animTime*0.018)*0.35;
      const alphaOuter = 0.15 + pulse*0.10;
      // glow externo dourado pulsante
      ctx.fillStyle = `rgba(255,215,0,${alphaOuter})`;
      ctx.beginPath(); ctx.arc(this.x, this.y + bob, 30 + pulse*6, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = `rgba(255,215,0,${0.45 + pulse*0.28})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(this.x, this.y + bob, 22 + pulse*2.5, 0, Math.PI*2); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.62 + pulse*0.22})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(this.x, this.y + bob, 18, 0, Math.PI*2); ctx.stroke();
      // estrelas orbitando
      const t = this.animTime*0.006;
      for(let i=0;i<3;i++){
        const ang = t + (i/3)*Math.PI*2;
        const rx = this.x + Math.cos(ang)*(22 + Math.sin(t*1.4+i)*2);
        const ry = this.y + bob + Math.sin(ang)*(22 + Math.cos(t*1.2+i)*2);
        ctx.fillStyle = i===0 ? '#ffd700' : i===1 ? '#fff8a0' : '#ffffff';
        ctx.font = '7px monospace'; ctx.textAlign='center';
        ctx.fillText('⭐', rx, ry+3);
        ctx.textAlign='left';
        // rastro
        ctx.fillStyle = `rgba(255,215,0,${0.45})`;
        ctx.beginPath(); ctx.arc(rx - Math.cos(ang)*4, ry - Math.sin(ang)*4, 1.5, 0, Math.PI*2); ctx.fill();
      }
      // anel interno estrelado
      ctx.strokeStyle = `rgba(255,215,0,${0.35+pulse*0.18})`;
      ctx.lineWidth = 1.4; ctx.setLineDash([4,3]);
      ctx.beginPath(); ctx.arc(this.x, this.y + bob, 14 + pulse*1.6, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
      // brilho central pulsante
      if(Math.floor(this.animTime/120)%2===0){
        ctx.fillStyle = `rgba(255,255,255,${0.28+pulse*0.16})`;
        ctx.beginPath(); ctx.arc(this.x, this.y + bob, 10, 0, Math.PI*2); ctx.fill();
      }
      // timer textual
      const secs = Math.ceil(this.powerStarTimer/1000);
      ctx.fillStyle = 'rgba(255,215,0,0.98)';
      ctx.font = '6px "Press Start 2P"'; ctx.textAlign='center';
      ctx.fillText(`⭐ ${secs}s`, this.x, y - 14 + bob); ctx.textAlign='left';
    }
    ctx.globalAlpha = 1;
  }
  getRect() { return { x: this.x - this.w/2, y: this.y - this.h/2, w: this.w, h: this.h }; }
}

// ===================== CHASER =====================
class Chaser {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.w = ENEMY_SIZE; this.h = ENEMY_SIZE;
    this.speed = ENEMY_SPEED + randRange(-0.2, 0.35);
    this._baseSpeed = this.speed; // guarda para lentidão Flecha Stand
    this.hp = ENEMY_HP; this.maxHp = ENEMY_HP;
    this.damageCooldown = 0; this.hitFlash = 0; this.dead = false; this.anim = Math.random()*1000;
    this.type='chaser';
    this.collisionDamage = 1;
    this.variation = null;
    // Status Flecha Stand
    this.slowTimer=0; this.slowFactor=1; this.stunTimer=0;
  }
  takeDamage(dmg) { this.hp -= dmg; this.hitFlash = 160; if (this.hp <= 0) { this.dead = true; return true; } return false; }
  update(dt, player, walls) {
    this.anim += dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.damageCooldown > 0) this.damageCooldown -= dt;
    // Flecha Stand - Paralisia (imobiliza totalmente)
    if(this.stunTimer>0){ this.stunTimer-=dt; if(this.stunTimer<=0) this.stunTimer=0; return; }
    // Flecha Stand - Lentidão
    let effSpeed = this.speed;
    if(this.slowTimer>0){
      this.slowTimer-=dt;
      if(this.slowTimer<=0){ this.slowTimer=0; this.slowFactor=1; this.speed=this._baseSpeed; effSpeed=this.speed; }
      else { effSpeed=this._baseSpeed * this.slowFactor; }
    } else { this.speed=this._baseSpeed; effSpeed=this.speed; }
    if (this.dead) return;
    const dx = player.x - this.x, dy = player.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d > 4) {
      let vx = (dx / d) * effSpeed, vy = (dy / d) * effSpeed;
      const nx = this.x + vx, ny = this.y + vy;
      if (!this.collidesWalls(nx, this.y, walls)) this.x = nx; else vx=0;
      if (!this.collidesWalls(this.x, ny, walls)) this.y = ny; else vy=0;
      if (vx===0 && vy===0) {
        const altX = this.x + (Math.random()-0.5)*effSpeed, altY = this.y + (Math.random()-0.5)*effSpeed;
        if (!this.collidesWalls(altX, this.y, walls)) this.x = altX;
        if (!this.collidesWalls(this.x, altY, walls)) this.y = altY;
      }
    }
    this.x = clamp(this.x, WALL_THICK + this.w/2, CANVAS_W - WALL_THICK - this.w/2);
    this.y = clamp(this.y, WALL_THICK + this.h/2, CANVAS_H - WALL_THICK - this.h/2);
  }
  collidesWalls(nx, ny, walls) {
    const hw=this.w/2, hh=this.h/2, rx=nx-hw, ry=ny-hh;
    for(const w of walls) if(rectCollide(rx, ry, this.w, this.h, w.x, w.y, w.w, w.h)) return true;
    return false;
  }
  canDamage(){ return this.damageCooldown<=0; }
  resetDamageCooldown(){ this.damageCooldown=ENEMY_DAMAGE_COOLDOWN; }
  draw(ctx){
    const x=this.x-this.w/2, y=this.y-this.h/2, bob=Math.sin(this.anim*0.008)*1.5;
    const isFlash=this.hitFlash>0 && Math.floor(this.hitFlash/40)%2===0;
    // Aura lentidão/paralisia Flecha Stand
    if(this.stunTimer>0){
      const pulse=0.5+Math.sin(this.anim*0.015)*0.35;
      ctx.fillStyle=`rgba(255,215,0,${0.18+pulse*0.12})`;
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.9+pulse*3,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle=`rgba(255,215,0,0.55)`; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.85,0,Math.PI*2); ctx.stroke();
    } else if(this.slowTimer>0){
      const pulse=0.5+Math.sin(this.anim*0.012)*0.30;
      ctx.fillStyle=`rgba(96,165,250,${0.16+pulse*0.09})`;
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.85+pulse*2,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle=`rgba(96,165,250,0.45)`; ctx.lineWidth=1.2;
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.82,0,Math.PI*2); ctx.stroke();
    }
    drawVariationAura(ctx,this,bob);
    ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(x+2, y+this.h-3, this.w, 3);
    let baseCol='#c0392b'; if(this.variation==='tank') baseCol='#2a5a9a'; else if(this.variation==='brute') baseCol='#7a1a10'; else if(this.variation==='elite') baseCol='#5a1a9a';
    ctx.fillStyle=isFlash?'#ffaaaa': this.stunTimer>0?'#a1a1aa' : this.slowTimer>0?'#60a5fa':baseCol; ctx.fillRect(x, y+4+bob, this.w, this.h-6);
    ctx.fillStyle=isFlash?'#ff6b6b': this.stunTimer>0?'#6b7280' : this.slowTimer>0?'#3b82f6':'#7a1a10'; ctx.fillRect(x+2,y+2+bob,this.w-4,4); ctx.fillRect(x+6,y+bob,4,4); ctx.fillRect(x+18,y+bob,4,4);
    ctx.fillStyle=isFlash?'#fff':'#ffeb3b'; ctx.fillRect(x+6,y+10+bob,6,6); ctx.fillRect(x+16,y+10+bob,6,6);
    // Ícone stun: estrelinhas sobre cabeça
    if(this.stunTimer>0){
      ctx.fillStyle='#ffd700'; ctx.font='7px monospace'; ctx.textAlign='center';
      const sx=this.x+Math.sin(this.anim*0.02)*4, sy=y-6+bob+Math.cos(this.anim*0.02)*2;
      ctx.fillText('★ ★', sx, sy); ctx.textAlign='left';
      ctx.fillStyle='rgba(255,255,255,0.95)';
      ctx.beginPath(); ctx.arc(sx-5,sy-2,1.2,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx+5,sy-2,1.2,0,Math.PI*2); ctx.fill();
    } else if(this.slowTimer>0){
      ctx.fillStyle='rgba(96,165,250,0.95)'; ctx.font='6px monospace'; ctx.textAlign='center';
      ctx.fillText('❄', this.x, y-7+bob); ctx.textAlign='left';
    }
    ctx.fillStyle='#1a0000'; ctx.fillRect(x+8,y+12+bob,2,4); ctx.fillRect(x+18,y+12+bob,2,4);
    ctx.fillStyle='#1a0000'; ctx.fillRect(x+10,y+18+bob,8,3); ctx.fillStyle='#fff'; ctx.fillRect(x+11,y+18+bob,2,2); ctx.fillRect(x+15,y+18+bob,2,2);
    if(this.hp < this.maxHp){ const hpPct=clamp(this.hp/this.maxHp,0,1); ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(x,y-6+bob,this.w,4); ctx.fillStyle=hpPct>0.5?'#4ade80':hpPct>0.25?'#facc15':'#ef4444'; ctx.fillRect(x,y-6+bob,this.w*hpPct,4); }
    drawVariationIcon(ctx,this,x,y,bob);
  }
  getRect(){ return {x:this.x-this.w/2,y:this.y-this.h/2,w:this.w,h:this.h}; }
}

// ===================== FUGITIVE (NOVO INIMIGO) =====================
// Foge quando jogador se aproxima, mantém distância mínima, atira lentamente
class Fugitive {
  constructor(x, y) {
    this.x=x; this.y=y;
    this.w=FUGITIVE_SIZE; this.h=FUGITIVE_SIZE;
    this.speed=FUGITIVE_SPEED;
    this._baseSpeed=FUGITIVE_SPEED;
    this.hp=FUGITIVE_HP; this.maxHp=FUGITIVE_HP;
    this.hitFlash=0; this.dead=false; this.anim=Math.random()*1000;
    this.type='fugitive';
    this.collisionDamage = 1;
    this.bulletDamage = 1;
    this.bulletSpeed = FUGITIVE_BULLET_SPEED;
    this.variation = null;
    this.damageCooldown=0;
    this.shootCooldown= randRange(600, FUGITIVE_SHOOT_COOLDOWN); // variação inicial
    this.fleeDir={x:0,y:0};
    this.wanderAngle=Math.random()*Math.PI*2;
    this.slowTimer=0; this.slowFactor=1; this.stunTimer=0;
  }
  takeDamage(dmg){ this.hp-=dmg; this.hitFlash=170; if(this.hp<=0){ this.dead=true; return true;} return false; }
  canDamage(){ return this.damageCooldown<=0; }
  resetDamageCooldown(){ this.damageCooldown=ENEMY_DAMAGE_COOLDOWN; }
  collidesWalls(nx,ny,walls){
    const hw=this.w/2, hh=this.h/2, rx=nx-hw, ry=ny-hh;
    for(const w of walls) if(rectCollide(rx,ry,this.w,this.h,w.x,w.y,w.w,w.h)) return true;
    return false;
  }
  // tenta evitar paredes ajustando direção
  avoidWalls(dirX, dirY, walls){
    // testa 3 direções: frente, +45°, -45°, escolhe livre
    const tryDirs=[
      {x:dirX,y:dirY},
      {x:dirX*Math.cos(0.7)-dirY*Math.sin(0.7), y:dirX*Math.sin(0.7)+dirY*Math.cos(0.7)},
      {x:dirX*Math.cos(-0.7)-dirY*Math.sin(-0.7), y:dirX*Math.sin(-0.7)+dirY*Math.cos(-0.7)},
    ];
    for(const d of tryDirs){
      const n=normalize(d.x,d.y);
      const nx=this.x + n.x*this.speed*2;
      const ny=this.y + n.y*this.speed*2;
      if(!this.collidesWalls(nx, ny, walls)) return n;
    }
    return normalize(dirX, dirY);
  }
  update(dt, player, walls, bulletsOut){
    this.anim+=dt;
    if(this.hitFlash>0) this.hitFlash-=dt;
    if(this.damageCooldown>0) this.damageCooldown-=dt;
    if(this.shootCooldown>0) this.shootCooldown-=dt;
    // Flecha Stand - Paralisia
    if(this.stunTimer>0){ this.stunTimer-=dt; if(this.stunTimer<=0) this.stunTimer=0; return; }
    // Lentidão
    let effSpeed = this._baseSpeed;
    if(this.slowTimer>0){ this.slowTimer-=dt; if(this.slowTimer<=0){ this.slowTimer=0; this.slowFactor=1; this.speed=this._baseSpeed; } else effSpeed=this._baseSpeed*this.slowFactor; }
    else { this.speed=this._baseSpeed; }
    if(this.dead) return;

    const dx = this.x - player.x;
    const dy = this.y - player.y;
    const d = Math.hypot(dx,dy);

    // Comportamento de fuga
    let moveX=0, moveY=0;
    if(d < FUGITIVE_DETECT_RADIUS){
      // foge na direção oposta ao jogador
      let fleeX = dx / (d||1);
      let fleeY = dy / (d||1);
      // mantém distância mínima: se muito perto, velocidade máxima; se médio, moderada
      const urgency = clamp(1 - (d / FUGITIVE_KEEP_DISTANCE), 0.3, 1);
      // evita paredes
      const avoid = this.avoidWalls(fleeX, fleeY, walls);
      fleeX=avoid.x; fleeY=avoid.y;
      moveX = fleeX * effSpeed * (0.7 + urgency*0.6);
      moveY = fleeY * effSpeed * (0.7 + urgency*0.6);

      // adiciona pequeno desvio lateral para não ficar preso em linha reta contra parede
      const perp = Math.sin(this.anim*0.003)*0.35;
      moveX += -fleeY * perp;
      moveY += fleeX * perp;
    } else if(d > FUGITIVE_KEEP_DISTANCE + 40){
      // suficientemente distante: diminui/parar - slow wander
      this.wanderAngle += randRange(-0.04,0.04);
      // 70% chance de parar quando distante (pode ficar parado observando)
      if(d > FUGITIVE_KEEP_DISTANCE + 90 && Math.random()<0.04){
        moveX=0; moveY=0;
      } else {
        moveX = Math.cos(this.wanderAngle)*0.6;
        moveY = Math.sin(this.wanderAngle)*0.6;
      }
    } else {
      // zona intermediária: movimento lateral lento
      this.wanderAngle += randRange(-0.06,0.06);
      moveX = Math.cos(this.wanderAngle)*1.0 + (dx/(d||1))*0.4;
      moveY = Math.sin(this.wanderAngle)*1.0 + (dy/(d||1))*0.4;
    }

    // aplica movimento com colisão
    if(moveX!==0 || moveY!==0){
      const nx=this.x + moveX, ny=this.y + moveY;
      if(!this.collidesWalls(nx, this.y, walls)) this.x = nx;
      else {
        // tenta deslizamento vertical apenas
        const alt = this.avoidWalls(moveX, 0, walls);
        if(!this.collidesWalls(this.x+alt.x*1.5, this.y, walls)) this.x += alt.x*1.5;
      }
      if(!this.collidesWalls(this.x, ny, walls)) this.y = ny;
      else {
        const alt=this.avoidWalls(0, moveY, walls);
        if(!this.collidesWalls(this.x, this.y+alt.y*1.5, walls)) this.y += alt.y*1.5;
      }
    }

    this.x=clamp(this.x, WALL_THICK+this.w/2, CANVAS_W-WALL_THICK-this.w/2);
    this.y=clamp(this.y, WALL_THICK+this.h/2, CANVAS_H-WALL_THICK-this.h/2);

    // Ataque: dispara lentamente na direção do jogador no momento do disparo
    if(this.shootCooldown<=0 && d < 420 && d > 60){
      // verifica linha de visão simples (não atira através de parede grossa? Permite mas pode bloquear)
      let canSee=true;
      // checagem simples de parede entre inimigo e jogador (amostragem)
      const steps=8;
      for(let i=1;i<steps;i++){
        const t=i/steps, sx=lerp(this.x, player.x, t), sy=lerp(this.y, player.y, t);
        for(const w of walls) if(rectCollide(sx-2,sy-2,4,4,w.x,w.y,w.w,w.h)){ canSee=false; break; }
        if(!canSee) break;
      }
      if(canSee || Math.random()<0.35){ // 35% chance de atirar mesmo sem visão (supressão)
        const dir = normalize(player.x - this.x, player.y - this.y);
        // pequena imprecisão para ser desviável
        const jitter = randRange(-0.12,0.12);
        const ang=Math.atan2(dir.y,dir.x)+jitter;
        const dx2=Math.cos(ang), dy2=Math.sin(ang);
        // Brutal/Elite atiram mais forte e mais rápido
        bulletsOut.push(new Bullet(this.x, this.y, dx2, dy2, 'enemy', {
          speed: this.bulletSpeed || FUGITIVE_BULLET_SPEED,
          damage: this.bulletDamage || 1,
          range: FUGITIVE_BULLET_RANGE,
          size: FUGITIVE_BULLET_SIZE + (this.variation==='brute'||this.variation==='elite'?1:0),
          color: this.variation==='brute'||this.variation==='elite' ? '#ff3b30' : '#c084fc',
          glow: this.variation==='brute'||this.variation==='elite' ? 'rgba(255,59,48,0.32)' : 'rgba(192,132,252,0.28)'
        }));
        this.shootCooldown = FUGITIVE_SHOOT_COOLDOWN + randRange(-250,350);
      } else {
        this.shootCooldown = 320; // tenta novamente em breve
      }
    }
  }
  draw(ctx){
    const x=this.x-this.w/2, y=this.y-this.h/2, bob=Math.sin(this.anim*0.009)*1.8;
    const isFlash=this.hitFlash>0 && Math.floor(this.hitFlash/45)%2===0;
    if(this.stunTimer>0){
      const pulse=0.5+Math.sin(this.anim*0.015)*0.35;
      ctx.fillStyle=`rgba(255,215,0,${0.18+pulse*0.12})`;
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.9+pulse*3,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle=`rgba(255,215,0,0.55)`; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.85,0,Math.PI*2); ctx.stroke();
    } else if(this.slowTimer>0){
      const pulse=0.5+Math.sin(this.anim*0.012)*0.30;
      ctx.fillStyle=`rgba(96,165,250,${0.16+pulse*0.09})`;
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.85+pulse*2,0,Math.PI*2); ctx.fill();
    }
    drawVariationAura(ctx,this,bob);
    ctx.fillStyle='rgba(0,0,0,0.32)'; ctx.fillRect(x+2, y+this.h-3, this.w, 3);
    // corpo esguio roxo fugitivo - variação
    let fugBase='#7c3aed'; if(this.variation==='tank') fugBase='#3a5a9a'; else if(this.variation==='brute') fugBase='#7a1a10'; else if(this.variation==='elite') fugBase='#5a1a9a';
    ctx.fillStyle=isFlash?'#f5d0ff': this.stunTimer>0?'#a1a1aa' : this.slowTimer>0?'#60a5fa':fugBase;
    ctx.fillRect(x+2, y+4+bob, this.w-4, this.h-6);
    // capa/vento
    ctx.fillStyle=isFlash?'#e9aaff':'#4c1d95';
    ctx.fillRect(x, y+6+bob, 4, this.h-10);
    ctx.fillRect(x+this.w-4, y+6+bob, 4, this.h-10);
    // cabeça alongada
    ctx.fillStyle=isFlash?'#fff':'#ddd6fe';
    ctx.fillRect(x+6, y+1+bob, this.w-12, 10);
    // olhos grandes assustados (fugitivo)
    ctx.fillStyle='#1a0a2e';
    ctx.fillRect(x+7, y+3+bob, 5, 5);
    ctx.fillRect(x+14, y+3+bob, 5, 5);
    ctx.fillStyle='#f43f5e';
    ctx.fillRect(x+8, y+4+bob, 3, 2);
    ctx.fillRect(x+15, y+4+bob, 3, 2);
    ctx.fillStyle='#fff';
    ctx.fillRect(x+9, y+6+bob, 1, 1);
    ctx.fillRect(x+16, y+6+bob, 1, 1);
    // pernas finas correndo (anim) - paralisa se stun
    if(this.stunTimer>0){
      ctx.fillStyle='#6b7280';
      ctx.fillRect(x+6, y+16+bob, 4, 6); ctx.fillRect(x+16, y+16+bob, 4, 6);
      ctx.fillStyle='#ffd700'; ctx.font='6px monospace'; ctx.textAlign='center';
      const sx=this.x+Math.sin(this.anim*0.02)*3; ctx.fillText('★ ★', sx, y-7+bob); ctx.textAlign='left';
    } else {
      const run = Math.sin(this.anim*0.02)>0;
      ctx.fillStyle=this.slowTimer>0?'#3b82f6':'#4c1d95';
      if(run){ ctx.fillRect(x+6, y+16+bob, 4, 6); ctx.fillRect(x+16, y+18+bob, 4, 4); }
      else { ctx.fillRect(x+6, y+18+bob, 4, 4); ctx.fillRect(x+16, y+16+bob, 4, 6); }
      if(this.slowTimer>0){ ctx.fillStyle='rgba(96,165,250,0.95)'; ctx.font='6px monospace'; ctx.textAlign='center'; ctx.fillText('❄', this.x, y-7+bob); ctx.textAlign='left'; }
    }
    // barra vida
    if(this.hp < this.maxHp){ const pct=clamp(this.hp/this.maxHp,0,1); ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(x,y-6+bob,this.w,4); ctx.fillStyle=pct>0.5?'#a78bfa':'#ef4444'; ctx.fillRect(x,y-6+bob,this.w*pct,4); }
    drawVariationIcon(ctx,this,x,y,bob);
    // indicador fugitivo (texto pequeno)
    if(this.shootCooldown < 300){
      ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.font='5px monospace'; ctx.textAlign='center';
      ctx.fillText('!', this.x, y-8+bob); ctx.textAlign='left';
    }
  }
  getRect(){ return {x:this.x-this.w/2,y:this.y-this.h/2,w:this.w,h:this.h}; }
}

// ===================== X-SHOOTER (FASE 2+ - ANDA E ATIRA EM X) =====================
class XShooter {
  constructor(x, y){
    this.x=x; this.y=y;
    this.w=XSHOOTER_SIZE; this.h=XSHOOTER_SIZE;
    this.speed=XSHOOTER_SPEED; this._baseSpeed=XSHOOTER_SPEED;
    this.hp=XSHOOTER_HP; this.maxHp=XSHOOTER_HP;
    this.hitFlash=0; this.dead=false; this.anim=Math.random()*1000;
    this.type='xshooter';
    this.collisionDamage=1;
    this.bulletDamage=XSHOOTER_BULLET_DAMAGE;
    this.bulletSpeed=XSHOOTER_BULLET_SPEED;
    this.variation=null;
    this.damageCooldown=0;
    this.shootCooldown= randRange(700, XSHOOTER_SHOOT_COOLDOWN);
    this.wanderAngle=Math.random()*Math.PI*2;
    this.wanderTimer= randRange(900, 1600);
    this.slowTimer=0; this.slowFactor=1; this.stunTimer=0;
  }
  takeDamage(dmg){ this.hp-=dmg; this.hitFlash=170; if(this.hp<=0){ this.dead=true; return true;} return false; }
  canDamage(){ return this.damageCooldown<=0; }
  resetDamageCooldown(){ this.damageCooldown=ENEMY_DAMAGE_COOLDOWN; }
  collidesWalls(nx,ny,walls){
    const hw=this.w/2, hh=this.h/2, rx=nx-hw, ry=ny-hh;
    for(const w of walls) if(rectCollide(rx,ry,this.w,this.h,w.x,w.y,w.w,w.h)) return true;
    return false;
  }
  update(dt, player, walls, bulletsOut){
    this.anim+=dt;
    if(this.hitFlash>0) this.hitFlash-=dt;
    if(this.damageCooldown>0) this.damageCooldown-=dt;
    if(this.shootCooldown>0) this.shootCooldown-=dt;
    if(this.stunTimer>0){ this.stunTimer-=dt; if(this.stunTimer<=0) this.stunTimer=0; return; }
    let effSpeed=this._baseSpeed;
    if(this.slowTimer>0){
      this.slowTimer-=dt;
      if(this.slowTimer<=0){ this.slowTimer=0; this.slowFactor=1; this.speed=this._baseSpeed; }
      else effSpeed=this._baseSpeed*this.slowFactor;
    } else this.speed=this._baseSpeed;
    if(this.dead) return;
    // wander - anda pela área, troca direção periodicamente
    this.wanderTimer-=dt;
    if(this.wanderTimer<=0){
      this.wanderAngle += randRange(-0.9,0.9);
      // ocasionalmente mira levemente no jogador (20% chance)
      if(Math.random()<0.20 && player){
        const angToPlayer=Math.atan2(player.y-this.y, player.x-this.x);
        let diff=angToPlayer - this.wanderAngle;
        while(diff>Math.PI) diff-=Math.PI*2;
        while(diff<-Math.PI) diff+=Math.PI*2;
        this.wanderAngle += diff*0.35;
      }
      this.wanderTimer= randRange(900, 1700);
    }
    // movimento com desvio de parede
    let moveX=Math.cos(this.wanderAngle)*effSpeed;
    let moveY=Math.sin(this.wanderAngle)*effSpeed;
    let nx=this.x+moveX, ny=this.y+moveY;
    let blockedX=this.collidesWalls(nx,this.y,walls);
    let blockedY=this.collidesWalls(this.x,ny,walls);
    if(blockedX){
      this.wanderAngle=Math.PI - this.wanderAngle + randRange(-0.3,0.3);
      nx=this.x+Math.cos(this.wanderAngle)*effSpeed;
      blockedX=this.collidesWalls(nx,this.y,walls);
      if(!blockedX) this.x=nx;
    } else this.x=nx;
    if(blockedY){
      this.wanderAngle= -this.wanderAngle + randRange(-0.3,0.3);
      ny=this.y+Math.sin(this.wanderAngle)*effSpeed;
      if(!this.collidesWalls(this.x,ny,walls)) this.y=ny;
    } else this.y=ny;
    this.x=clamp(this.x, WALL_THICK+this.w/2, CANVAS_W-WALL_THICK-this.w/2);
    this.y=clamp(this.y, WALL_THICK+this.h/2, CANVAS_H-WALL_THICK-this.h/2);
    // atira em X (4 diagonais) quando cooldown pronto
    if(this.shootCooldown<=0){
      const off=8;
      const dirs=[
        {x: 0.707, y: 0.707}, {x:-0.707, y: 0.707},
        {x: 0.707, y:-0.707}, {x:-0.707, y:-0.707}
      ];
      for(const d of dirs){
        // verifica se parede muito próxima bloqueia (opcional, atira mesmo através mas reduz)
        bulletsOut.push(new Bullet(this.x + d.x*off, this.y + d.y*off, d.x, d.y, 'enemy', {
          speed: this.bulletSpeed,
          damage: this.bulletDamage,
          range: XSHOOTER_BULLET_RANGE,
          size: XSHOOTER_BULLET_SIZE,
          color: this.variation==='brute'||this.variation==='elite' ? '#ff3b30' : '#fb923c',
          glow: this.variation==='brute'||this.variation==='elite' ? 'rgba(255,59,48,0.32)' : 'rgba(251,146,60,0.28)'
        }));
      }
      this.shootCooldown = XSHOOTER_SHOOT_COOLDOWN + randRange(-180, 220);
      // flash visual
      this.hitFlash=90;
    }
  }
  draw(ctx){
    const x=this.x-this.w/2, y=this.y-this.h/2, bob=Math.sin(this.anim*0.009)*1.4;
    const isFlash=this.hitFlash>0 && Math.floor(this.hitFlash/40)%2===0;
    const pulse=0.5+Math.sin(this.anim*0.013)*0.28;
    const shootReady=this.shootCooldown<300;
    if(this.stunTimer>0){
      const pulseS=0.5+Math.sin(this.anim*0.015)*0.35;
      ctx.fillStyle=`rgba(255,215,0,${0.18+pulseS*0.12})`;
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.9+pulseS*3,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle=`rgba(255,215,0,0.55)`; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.85,0,Math.PI*2); ctx.stroke();
    } else if(this.slowTimer>0){
      const pulseSl=0.5+Math.sin(this.anim*0.012)*0.30;
      ctx.fillStyle=`rgba(96,165,250,${0.16+pulseSl*0.09})`;
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.85+pulseSl*2,0,Math.PI*2); ctx.fill();
    } else {
      ctx.fillStyle=`rgba(251,146,60,${0.10+pulse*0.06})`;
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.96+pulse*2.2,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle=`rgba(251,146,60,${0.14+pulse*0.08})`; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(this.x, this.y+bob, this.w*0.78,0,Math.PI*2); ctx.stroke();
    }
    drawVariationAura(ctx,this,bob);
    ctx.fillStyle='rgba(0,0,0,0.32)'; ctx.fillRect(x+2, y+this.h-3, this.w, 3);
    let base='#c2410c'; if(this.variation==='tank') base='#1e3a5a'; else if(this.variation==='brute') base='#7f1d1d'; else if(this.variation==='elite') base='#581c87';
    let baseLight='#fb923c'; if(this.variation==='tank') baseLight='#3b82f6'; else if(this.variation==='brute') baseLight='#ef4444'; else if(this.variation==='elite') baseLight='#a78bfa';
    ctx.fillStyle=isFlash?'#fde68a': base;
    ctx.fillRect(x+2, y+4+bob, this.w-4, this.h-6);
    ctx.fillStyle=isFlash?'#fffbeb': 'rgba(255,255,255,0.22)';
    ctx.fillRect(x+2, y+4+bob, this.w-4, 2);
    ctx.strokeStyle='rgba(0,0,0,0.28)'; ctx.lineWidth=1; ctx.strokeRect(x+2, y+4+bob, this.w-4, this.h-6);
    // canhões X nos cantos com cano diagonal animado
    const canOff= shootReady ? 1.4 : 0;
    const canDark=isFlash?'#fff':'#431407';
    const corners=[{dx:0,dy:0, dir:{x:-0.707,y:-0.707}}, {dx:this.w-5,dy:0, dir:{x:0.707,y:-0.707}}, {dx:0,dy:this.h-7, dir:{x:-0.707,y:0.707}}, {dx:this.w-5,dy:this.h-7, dir:{x:0.707,y:0.707}}];
    for(const c of corners){
      const cx=x+c.dx, cy=y+c.dy+bob;
      ctx.fillStyle=canDark; ctx.fillRect(cx, cy, 5,5);
      ctx.fillStyle=isFlash?'#fff':baseLight; ctx.fillRect(cx+1, cy+1, 3,3);
      ctx.strokeStyle=isFlash?'#fff':baseLight; ctx.lineWidth=1.8; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(cx+2.5, cy+2.5); ctx.lineTo(cx+2.5 + c.dir.x*(4.5+canOff*1.8), cy+2.5 + c.dir.y*(4.5+canOff*1.8)); ctx.stroke(); ctx.lineCap='butt';
      if(shootReady){
        ctx.fillStyle='rgba(255,255,255,0.96)'; ctx.beginPath(); ctx.arc(cx+2.5 + c.dir.x*4.5, cy+2.5 + c.dir.y*4.5, 1.1,0,Math.PI*2); ctx.fill();
      }
    }
    // núcleo central com X pulsante
    const corePulse= shootReady ? 0.85 : 0.5+Math.sin(this.anim*0.014)*0.2;
    ctx.fillStyle=isFlash?'#fff':'#7c2d12'; ctx.fillRect(x+8, y+8+bob, this.w-16, 4);
    ctx.fillRect(x+10, y+6+bob, 4, 8);
    ctx.strokeStyle=isFlash?'#fff':`rgba(254,215,170,${0.9+corePulse*0.1})`; ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.moveTo(x+9, y+9+bob); ctx.lineTo(x+15, y+15+bob); ctx.moveTo(x+15, y+9+bob); ctx.lineTo(x+9, y+15+bob); ctx.stroke();
    if(shootReady){
      ctx.fillStyle=`rgba(251,146,60,${0.18+corePulse*0.14})`; ctx.beginPath(); ctx.arc(this.x, this.y+bob, 8,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.96)'; ctx.beginPath(); ctx.arc(this.x, this.y+bob, 1.7,0,Math.PI*2); ctx.fill();
    }
    // olhos
    ctx.fillStyle=isFlash?'#fff':'#1a0a00';
    ctx.fillRect(x+7, y+5+bob, 3,2); ctx.fillRect(x+16, y+5+bob, 3,2);
    ctx.fillStyle='#fff'; ctx.fillRect(x+8, y+5.5+bob, 1,1); ctx.fillRect(x+17, y+5.5+bob, 1,1);
    if(this.stunTimer>0){
      ctx.fillStyle='#ffd700'; ctx.font='6px monospace'; ctx.textAlign='center';
      const sx=this.x+Math.sin(this.anim*0.02)*3; ctx.fillText('★ ★', sx, y-7+bob); ctx.textAlign='left';
    } else if(this.slowTimer>0){
      ctx.fillStyle='rgba(96,165,250,0.95)'; ctx.font='6px monospace'; ctx.textAlign='center';
      ctx.fillText('❄', this.x, y-7+bob); ctx.textAlign='left';
    } else if(shootReady){
      ctx.fillStyle='rgba(251,146,60,0.96)'; ctx.font='5px monospace'; ctx.textAlign='center';
      ctx.fillText('◉', this.x, y-7+bob); ctx.textAlign='left';
    }
    if(this.hp < this.maxHp){ const pct=clamp(this.hp/this.maxHp,0,1); ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(x,y-6+bob,this.w,4); ctx.fillStyle=pct>0.5?'#fb923c':'#ef4444'; ctx.fillRect(x,y-6+bob,this.w*pct,4); ctx.strokeStyle='rgba(255,255,255,0.10)'; ctx.lineWidth=0.8; ctx.strokeRect(x,y-6+bob,this.w,4); }
    drawVariationIcon(ctx,this,x,y,bob);
  }
  getRect(){ return {x:this.x-this.w/2,y:this.y-this.h/2,w:this.w,h:this.h}; }
}

// ===================== ROOM =====================
class Room {
  constructor(gx, gy, doors, isStart = false, seedRand, floor = 1) {
    this.gx = gx; this.gy = gy;
    this.doors = doors;
    this.floor = floor; // 1 ou 2 (preparado para N)
    this.theme = FLOOR_THEMES[floor] || FLOOR_THEMES[1];
    this.isStart = isStart;
    this.visited = isStart;
    this.enemies = [];
    this.walls = [];
    this.items = []; // itens no chão
    this.fires = []; // rastros de fogo desta sala
    this.spikes = []; // espinhos fase 3
    this.explosions = []; // círculos de explosão kamikaze {x,y,r,life,max}
    this.farmarAuras = []; // auras expansivas JL - Farmar Aura 67
    this.exitPortal = null; // só na sala exit
    this.type = isStart ? 'start' : (seedRand() < 0.14 ? 'treasure' : 'enemy');
    this.isExit = false;
    this.isRare = false; // sala rara de item lendário
    this.isMiniboss = false; // Fase 4 miniboss
    this.minibossDefeated = false;
    this.isBossStair = false; // Fase 5 boss da escada
    this.bossStairDefeated = false;
    this.bossDialogShown = false; // para diálogo SIM/NÃO
    this.bossFightStarted = false;
    // Hacker - Boss final secreto após Escada
    this.isHacker = false; // sala do Hacker (Dark Vírus)
    this.hackerDefeated = false;
    this.hackerLocked = true; // bloqueada até derrotar Boss Escada
    this.hackerDialogActive = false;
    this.hackerBattleStarted = false;
    this.corruptedStair = null; // portal escada corrompida na sala da Escada após vitória
    this.hackerRoomRef = null; // referência para sala hacker (se gerada via grid)
    this.glitchTimer = 0;
    this.isPartyHorde = false; // sala de festa — horda em qualquer fase
    this.partyHordeDefeated = false;
    this.partyWave = 0; // onda atual (0 = não iniciado)
    this.partyWavesRemaining = 0;
    this.partyWaveTimer = 0;
    this.partyConfetti = []; // decoração flutuante
    this.rareItemCollected = false;
    this.buildWalls(seedRand);
    if (!isStart) {
      if (this.type === 'enemy' || this.type==='treasure') this.spawnEnemies(seedRand);
      this.spawnItems(seedRand);
      // espinhos apenas a partir da fase 3, e chance configurável (não bloqueia portas)
      if(this.floor===3 || this.floor===4) this.spawnSpikes(seedRand);
      if(this.floor===5 && this.type==='enemy' && seedRand()<0.18) this.spawnSpikes(seedRand); // poucos espinhos na fase 5 normal, mas boss arena sem
    }
  }

  buildWalls(rng) {
    this.walls = [];
    const t = WALL_THICK, dw = DOOR_W, dh = DOOR_H, cx = CANVAS_W/2, cy = CANVAS_H/2;
    const add = (x,y,w,h) => this.walls.push({x,y,w,h});
    if (this.doors.top) { add(0,0, cx - dw/2, t); add(cx + dw/2, 0, CANVAS_W - (cx + dw/2), t); }
    else add(0,0, CANVAS_W, t);
    if (this.doors.bottom) { add(0, CANVAS_H - t, cx - dw/2, t); add(cx + dw/2, CANVAS_H - t, CANVAS_W - (cx + dw/2), t); }
    else add(0, CANVAS_H - t, CANVAS_W, t);
    if (this.doors.left) { add(0,0, t, cy - dh/2); add(0, cy + dh/2, t, CANVAS_H - (cy + dh/2)); }
    else add(0,0, t, CANVAS_H);
    if (this.doors.right) { add(CANVAS_W - t, 0, t, cy - dh/2); add(CANVAS_W - t, cy + dh/2, t, CANVAS_H - (cy + dh/2)); }
    else add(CANVAS_W - t, 0, t, CANVAS_H);

    // pilares com variação por fase
    let pillarChance = 0.5;
    if(this.floor===2) pillarChance=0.65;
    else if(this.floor===3) pillarChance=0.60;
    else if(this.floor===4) pillarChance=0.55;
    if (!this.isStart && rng() < pillarChance) {
      let count = 1;
      if(this.floor===2) count=randInt(1,3);
      else if(this.floor===3) count=randInt(2,3);
      else count=randInt(1,2);
      for (let i=0;i<count;i++) {
        let px, py, tries=0;
        do { px = randInt(140, CANVAS_W-140); py = randInt(110, CANVAS_H-110); tries++; } while (dist(px,py,cx,cy) < 90 && tries<10);
        const w = rng() < 0.5 ? 36 : 64;
        const h = rng() < 0.5 ? 36 : 28;
        add(px - w/2, py - h/2, w, h);
      }
    }
  }

   spawnEnemies(rng) {
    // Boss da escada não spawna inimigos normais (arena própria)
    if(this.isBossStair) return;
    if(this.isHacker) return;
    if(this.isPartyHorde) return; // horda tem spawn próprio por ondas
    // dificuldade escala com fase - Fase 4 mais difícil + DashEnemy
    if(this.isMiniboss) return; // miniboss lida separado
    let n;
    if(this.floor===4) n = randInt(4,6);
    else if(this.floor===3) n = randInt(4,6);
    else if(this.floor===2) n = randInt(3,5);
    else n = randInt(2,4);
    const cx = CANVAS_W/2, cy = CANVAS_H/2;
    for (let i=0;i<n;i++) {
      let x,y, tries=0;
      do {
        x = randRange(110, CANVAS_W-110);
        y = randRange(90, CANVAS_H-90);
        tries++;
        let onWall=false;
        for (const w of this.walls) if (rectCollide(x-14,y-14,28,28,w.x,w.y,w.w,w.h)) { onWall=true; break; }
        if (!onWall && dist(x,y,cx,cy) > 100) break;
      } while (tries<20);
      let e;
      if(this.floor===4){
        // Fase 4: X-Shooter 16% + dash 16% + kamikaze 16% + fugitive 14% + summoner 12% + resto chaser
        const roll = rng();
        const hasSummoner = this.enemies.some(en=>en.type==='summoner');
        if(!hasSummoner && roll < 0.12) e = new Summoner(x,y);
        else if(roll < 0.28) e = new XShooter(x,y);
        else if(roll < 0.44) e = new DashEnemy(x,y);
        else if(roll < 0.60) e = new Kamikaze(x,y);
        else if(roll < 0.74) e = new Fugitive(x,y);
        else e = new Chaser(x,y);
      } else if(this.floor===3){
        // Fase 3: X-Shooter 18% + summoner 20% + kamikaze 24% + fugitive 18% + resto chaser
        const roll = rng();
        const hasSummoner = this.enemies.some(en=>en.type==='summoner');
        if(!hasSummoner && roll < 0.20) e = new Summoner(x,y);
        else if(roll < 0.38) e = new XShooter(x,y);
        else if(roll < 0.62) e = new Kamikaze(x,y);
        else if(roll < 0.80) e = new Fugitive(x,y);
        else e = new Chaser(x,y);
      } else if(this.floor===2){
        const roll = rng();
        if(roll < 0.26) e = new XShooter(x,y);
        else if(roll < 0.56) e = new Fugitive(x,y);
        else e = new Chaser(x,y);
      } else if(this.floor===5){
        // Fase 5 corredores (antes da escada) - também com X-Shooter
        const roll = rng();
        const hasSummoner = this.enemies.some(en=>en.type==='summoner');
        if(!hasSummoner && roll < 0.10) e = new Summoner(x,y);
        else if(roll < 0.28) e = new XShooter(x,y);
        else if(roll < 0.44) e = new DashEnemy(x,y);
        else if(roll < 0.62) e = new Kamikaze(x,y);
        else if(roll < 0.78) e = new Fugitive(x,y);
        else e = new Chaser(x,y);
      } else {
        // Fase 1
        if (rng() < 0.18) e = new Fugitive(x,y);
        else e = new Chaser(x,y);
      }
      if (rng() < 0.22) { e.hp = (e.maxHp||2)+1; e.maxHp = e.hp; }
      if (this.floor===2 && e.type==='chaser' && rng()<0.25) e.speed += 0.25;
      if (this.floor===3 && e.type==='chaser' && rng()<0.30) e.speed += 0.35;
      // Variação de vida/dano (tanque/brutal/elite) - escala com andar
      applyEnemyVariation(e, rng, this.floor);
      this.enemies.push(e);
    }
    // balanceamento fase 3 e 4: limita summoners e fugitivos excessivos
    if(this.floor===3 || this.floor===4){
      const summoners = this.enemies.filter(e=>e.type==='summoner').length;
      if(summoners>1){
        // remove extras
        for(let k=this.enemies.length-1;k>=0 && this.enemies.filter(e=>e.type==='summoner').length>1;k--){
          if(this.enemies[k].type==='summoner') this.enemies.splice(k,1);
        }
      }
      if(this.enemies.filter(e=>e.type==='fugitive').length >=3 && rng()<0.6) this.enemies.pop();
      if(this.floor===4 && this.enemies.filter(e=>e.type==='dash').length >=3 && rng()<0.5) this.enemies.pop();
      // limita total para não estourar desempenho
      if(this.enemies.length>6) this.enemies.splice(6);
    } else {
      if (this.enemies.filter(e=>e.type==='fugitive').length >=3 && rng()<0.5) this.enemies.pop();
    }
  }

   spawnItems(rng){
    const cx=CANVAS_W/2, cy=CANVAS_H/2;
    const tryPlace = (item) => {
      let tries=0;
      while(tries<12){
        const nx = item.x, ny=item.y;
        let onWall=false;
        for(const w of this.walls) if(rectCollide(nx-item.w/2, ny-item.h/2, item.w, item.h, w.x,w.y,w.w,w.h)){ onWall=true; break; }
        if(!onWall && dist(nx,ny,cx,cy)>60) break;
        item.x = randRange(120, CANVAS_W-120);
        item.y = randRange(90, CANVAS_H-90);
        tries++;
      }
      this.items.push(item);
    };
    // Coração pequeno: ~28% floor1, 30% floor2
    const smallChance = this.floor===2 ? 0.30 : 0.28;
    if (rng() < smallChance){
      const it = new HealingItem(randRange(140, CANVAS_W-140), randRange(100, CANVAS_H-100), 1);
      tryPlace(it);
    }
    // Coração grande raro: ~12%
    if (rng() < 0.12){
      const it = new HealingItem(randRange(140, CANVAS_W-140), randRange(100, CANVAS_H-100), 2);
      if(this.items.length===0 || dist(it.x,it.y,this.items[0].x,this.items[0].y)>50) tryPlace(it);
    }
    // Coração Cibernético - concede 1 vida extra (aumenta maxHp) - raro mas visível
    const cyberChance = this.type==='treasure' ? CYBER_HEART_SPAWN_CHANCE*1.8 : CYBER_HEART_SPAWN_CHANCE;
    if (rng() < cyberChance && this.items.length < 4 && !this.isRare && !this.isBossStair && !this.isPartyHorde){
      if(!this.items.some(it=> it.type==='cyber_heart')){
        const it = new CyberHeartItem(randRange(140, CANVAS_W-140), randRange(100, CANVAS_H-100));
        // evita nascer sobre outro item e garante visibilidade
        if(this.items.length===0 || this.items.every(o=> dist(it.x,it.y,o.x,o.y)>48)) tryPlace(it);
      }
    }
    // Shotgun raro natural (fallback 6%)
    if (rng() < 0.06){
      const it = new WeaponItem(randRange(140, CANVAS_W-140), randRange(100, CANVAS_H-100), 'shotgun');
      tryPlace(it);
    }
    // Item raro passivo: Rastro de Fogo - chance muito baixa (1.8% por sala, mais alta em treasure)
    const flameChance = this.type==='treasure' ? 0.028 : 0.012;
    if (rng() < flameChance){
      const it = new FlameTrailItem(randRange(140, CANVAS_W-140), randRange(100, CANVAS_H-100));
      tryPlace(it);
    }
    // Segundo item novo: Botas Velozes - raro mas um pouco mais comum que fogo
    const bootsChance = this.type==='treasure' ? 0.06 : 0.028;
    if (rng() < bootsChance){
      const it = new SwiftBootsItem(randRange(140, CANVAS_W-140), randRange(100, CANVAS_H-100));
      // evita sobreposição com flame se já spawnou
      if(this.items.length<2 || !this.items.some(i=>i.type==='swift_boots')) tryPlace(it);
    }
    // Arma extremamente rara: RAIO - chance muito baixa (extremamente rara)
    const raioChance = this.floor===3 ? 0.011 : this.floor===2 ? 0.008 : 0.005;
    if (rng() < raioChance){
      const it = new WeaponItem(randRange(140, CANVAS_W-140), randRange(100, CANVAS_H-100), 'raio');
      tryPlace(it);
    }
    // Melhoria tiro duplo arma principal (lado a lado)
    const doubleChance = this.type==='treasure' ? 0.05 : 0.026;
    if(rng() < doubleChance && !this.isRare && !this.isBossStair && !this.isPartyHorde){
      if(!this.items.some(i=>i.type==='double_shot') && this.items.length<3){
        const it = new DoubleShotItem(randRange(140, CANVAS_W-140), randRange(100, CANVAS_H-100));
        tryPlace(it);
      }
    }
    // Metralhadora rara - alta cadência + aquecimento
    const mgChance = this.floor===3 ? 0.008 : 0.004;
    if(rng() < mgChance && !this.isBossStair && !this.isPartyHorde){
      const it = new WeaponItem(randRange(140, CANVAS_W-140), randRange(100, CANVAS_H-100), 'metralhadora');
      tryPlace(it);
    }
    // Arma comum carregada - mecânica de carga, deve aparecer com frequência como arma comum (7-9%)
    const chargedChance = this.type==='treasure' ? 0.09 : 0.07;
    if(rng() < chargedChance && !this.isRare && !this.isMiniboss && !this.isBossStair && !this.isPartyHorde && this.items.length < 3){
      if(!this.items.some(it=> it.weaponType && it.weaponType.toLowerCase()==='carregada')){
        const it = new WeaponItem(randRange(140, CANVAS_W-140), randRange(100, CANVAS_H-100), 'carregada');
        tryPlace(it);
      }
    }
    // BAZUCA muito rara - 0.6% Fase 4, 0.2% outras fases, prioriza miniboss (não spawna em miniboss)
    const bazucaChance = this.floor===4 ? 0.006 : this.floor===5 ? 0.008 : 0.002;
    if(rng() < bazucaChance && !this.isRare && !this.isMiniboss && !this.isBossStair && !this.isPartyHorde && this.items.length < 3){
      if(!this.items.some(it=> it.isBazuca || (it.weaponType && it.weaponType.toLowerCase()==='bazuca'))){
        const it = new WeaponItem(randRange(140, CANVAS_W-140), randRange(100, CANVAS_H-100), 'bazuca');
        tryPlace(it);
      }
    }
    // ===== NOVAS ARMAS COMUNS - distribuição equilibrada (cada fase variedade) =====
    // Cada arma tem estilo único mas DPS similar para não haver superior clara (requisito balanceamento)
    const commonPool = ['espada','luva'];
    const commonChance = this.type==='treasure' ? 0.22 : 0.14; // 14% normal, 22% tesouro (comum mas não flood)
    if(rng() < commonChance && !this.isRare && !this.isMiniboss && !this.isBossStair && !this.isHacker && !this.isPartyHorde && this.items.length < 4){
      // evita duplicar mesmo tipo já no chão
      let available = commonPool.filter(t=> !this.items.some(it=> it.weaponType && it.weaponType.toLowerCase()===t));
      // 60% chance de priorizar arma que jogador NÃO tem (variedade)
      if(available.length>1 && typeof window!=='undefined' && window.game && window.game.player){
        const owned=[];
        if(window.game.player.primaryWeapon) owned.push(window.game.player.primaryWeapon.name.toLowerCase());
        if(window.game.player.secondaryWeapon) owned.push(window.game.player.secondaryWeapon.name.toLowerCase());
        if(owned.length && rng()<0.60){
          const notOwned=available.filter(t=> !owned.includes(t));
          if(notOwned.length) available=notOwned;
        }
      }
      if(available.length){
        const pick=available[Math.floor(rng()*available.length)];
        const it=new WeaponItem(randRange(140, CANVAS_W-140), randRange(100, CANVAS_H-100), pick);
        tryPlace(it);
      }
    }
    // ===== MOTOSSERRA INCOMUM - curta distância, dano alto, Pochita upgrade =====
    const motosserraChance = this.type==='treasure' ? 0.09 : 0.045; // incomum: 4.5% normal, 9% treasure (balanceada)
    if(rng() < motosserraChance && !this.isRare && !this.isMiniboss && !this.isBossStair && !this.isHacker && !this.isPartyHorde && this.items.length < 4){
      if(!this.items.some(it=> it.weaponType && it.weaponType.toLowerCase()==='motosserra')){
        const it=new WeaponItem(randRange(140, CANVAS_W-140), randRange(100, CANVAS_H-100), 'motosserra');
        // motosserra é rara, garante visibilidade
        it.spawnDelay=240;
        tryPlace(it);
      }
    }
    // ===== ITENS ESPECIAIS (E) - Sistema modular =====
    // Chance balanceada: ~5% por sala normal, 10% em treasure, inclui Flecha Stand incomum + Power Star raro
    // Flecha Stand é incomum: aparece com boa frequência para testar, mas não toda sala
    const specialChance = this.type==='treasure' ? 0.10 : 0.05;
    if(rng() < specialChance && !this.isRare && !this.isMiniboss && !this.isBossStair && !this.isPartyHorde && this.items.length < 4){
      const rollSpecial = rng();
      // Distribuição: 30% espada, 30% escudo, 40% flecha_stand (incomum, levemente mais comum para teste)
      // Fácil alterar: ajuste limites abaixo para mudar chance
      let pickId;
      if(rollSpecial < 0.30) pickId='espada_flamejante';
      else if(rollSpecial < 0.60) pickId='escudo_magico';
      else pickId='flecha_stand';
      // Evita duplicar mesmo tipo no chão da mesma sala
      if(!this.items.some(it=> it.isSpecialPickup && it.specialId===pickId)){
        // Se jogador já possui esse especial, tenta oferecer outro (70% chance) para variedade
        let finalId = pickId;
        const owned = (typeof window!=='undefined' && window.game && window.game.player) ? window.game.player.equippedSpecial?.id : null;
        if(owned===pickId && rng()<0.70){
          const pool=['espada_flamejante','escudo_magico','flecha_stand'].filter(id=>id!==owned);
          finalId = pool[Math.floor(rng()*pool.length)];
        }
        const it = new SpecialItemPickup(randRange(140, CANVAS_W-140), randRange(100, CANVAS_H-100), finalId);
        tryPlace(it);
      }
    }
    // Gato Antivírus - passiva incomum (companheiro azul) - item normal, não especial
    const gatoChance = this.type==='treasure' ? 0.06 : 0.028; // 2.8% normal, 6% treasure (incomum)
    if(rng() < gatoChance && !this.isRare && !this.isMiniboss && !this.isBossStair && !this.isPartyHorde && this.items.length < 4){
      const hasGato = (typeof window!=='undefined' && window.game && window.game.player) ? window.game.player.hasGatoAntivirus : false;
      if(!hasGato && !this.items.some(it=> it.isGatoPickup)){
        const it = new GatoAntivirusPickup(randRange(140, CANVAS_W-140), randRange(100, CANVAS_H-100));
        tryPlace(it);
      }
    }
    // Power Star ⭐ - raro (sempre respeita cooldown 50s e mostra na HUD)
    const powerChance = this.type==='treasure' ? POWER_STAR_TREASURE_CHANCE : POWER_STAR_SPAWN_CHANCE;
    // Fase 5 tem chance levemente maior de Power Star (tem boss difícil)
    const adjustedPowerChance = this.floor===5 ? powerChance*1.6 : powerChance;
    if(rng() < adjustedPowerChance && !this.isRare && !this.isMiniboss && !this.isBossStair && !this.isPartyHorde && this.items.length < 4){
      if(!this.items.some(it=> it.isSpecialPickup && it.specialId==='power_star')){
        const it = new SpecialItemPickup(randRange(140, CANVAS_W-140), randRange(100, CANVAS_H-100), 'power_star');
        // Garante que power_star seja visível como raro: spawnDelay curto
        it.spawnDelay = 180;
        tryPlace(it);
      }
    }
    // Sistema de melhorias por arma (4 raridades) - spawn integrado e balanceado com níveis
    // Boost para personagens com armas exclusivas (JG/ Kinight/ Ash/ Dev)
    let upgradeChance = this.type==='treasure' ? 0.22 : 0.11; // chance base
    const __playerForChance = (typeof window!=='undefined' && window.game && window.game.player) ? window.game.player : null;
    if(__playerForChance && __playerForChance.characterDef){
      const exclusiveMapChance = { bastao:'BASTAO', cavaleiro:'ESPADA', motosserra:'MOTOSSERRA', raio_matematico:'RAIO_MATEMATICO', espada:'ESPADA' };
      const exclWChance = exclusiveMapChance[__playerForChance.characterDef.exclusive] || (__playerForChance.characterDef.allowedWeapons && __playerForChance.characterDef.allowedWeapons.length===1 ? __playerForChance.characterDef.allowedWeapons[0] : null);
      if(exclWChance){
        // Personagens exclusivos ganham +9% (normal) / +13% (treasure) de chance de melhoria da sua arma
        upgradeChance += this.type==='treasure' ? 0.13 : 0.09;
        upgradeChance = Math.min(upgradeChance, 0.45);
      }
    }
    if(rng() < upgradeChance && !this.isRare && !this.isMiniboss && !this.isBossStair && !this.isPartyHorde && this.items.length < 4){
      const roll = rng();
      let rarityPick;
      if(roll < 0.50) rarityPick='COMUM';
      else if(roll < 0.80) rarityPick='INCOMUM';
      else if(roll < 0.95) rarityPick='RARA';
      else rarityPick='MUITO_RARA';
      let pool = UPGRADE_DEFS.filter(u=>u.rarity===rarityPick);
      const player = (typeof window!=='undefined' && window.game && window.game.player) ? window.game.player : null;
      if(player){
        // filtra apenas upgrades que ainda podem subir de nível (evita duplicar max)
        const canAddPool = pool.filter(u=> player.canAddUpgrade(u.id));
        if(canAddPool.length) pool = canAddPool;
        else {
          const anyCanAdd = UPGRADE_DEFS.filter(u=> player.canAddUpgrade(u.id) && u.rarity===rarityPick);
          if(anyCanAdd.length) pool = anyCanAdd;
          else {
            const any = UPGRADE_DEFS.filter(u=> player.canAddUpgrade(u.id));
            pool = any; // qualquer que ainda pode subir
          }
        }
        if(pool.length){
          // Identifica arma exclusiva do personagem (se houver) para priorização forte
          let exclusiveWeapon = null;
          if(player.characterDef){
            const exclusiveMap = { bastao:'BASTAO', cavaleiro:'ESPADA', motosserra:'MOTOSSERRA', raio_matematico:'RAIO_MATEMATICO', espada:'ESPADA' };
            exclusiveWeapon = exclusiveMap[player.characterDef.exclusive] || null;
            if(!exclusiveWeapon && player.characterDef.allowedWeapons && player.characterDef.allowedWeapons.length===1){
              exclusiveWeapon = player.characterDef.allowedWeapons[0];
            }
          }
          if(exclusiveWeapon){
            // Para exclusivos: 88% chance de forçar melhoria da arma exclusiva
            const exclusivePool = pool.filter(u=>{
              const compat = u.compatible || [u.weapon];
              return u.weapon===exclusiveWeapon || compat.includes(exclusiveWeapon);
            });
            if(exclusivePool.length && rng() < 0.88){
              pool = exclusivePool;
            } else {
              // Falha no roll exclusivo: ainda tenta priorizar armas que possui (85%)
              const ownedWeapons = [];
              if(player.primaryWeapon) ownedWeapons.push(player.primaryWeapon.name);
              if(player.secondaryWeapon) ownedWeapons.push(player.secondaryWeapon.name);
              if(exclusiveWeapon && !ownedWeapons.includes(exclusiveWeapon)) ownedWeapons.push(exclusiveWeapon);
              const ownedPool = pool.filter(u=>{
                const compat = u.compatible || [u.weapon];
                return compat.includes('ALL') || u.weapon==='ALL' || ownedWeapons.some(ow=> compat.includes(ow)) || ownedWeapons.includes(u.weapon);
              });
              if(ownedPool.length && rng()<0.85) pool = ownedPool;
            }
          } else {
            // Personagens não-exclusivos: prioriza arma compatível que jogador possui (70%)
            const ownedWeapons = [];
            if(player.primaryWeapon) ownedWeapons.push(player.primaryWeapon.name);
            if(player.secondaryWeapon) ownedWeapons.push(player.secondaryWeapon.name);
            const ownedPool = pool.filter(u=>{
              const compat = u.compatible || [u.weapon];
              return compat.includes('ALL') || u.weapon==='ALL' || ownedWeapons.some(ow=> compat.includes(ow)) || ownedWeapons.includes(u.weapon);
            });
            if(ownedPool.length && rng()<0.70) pool = ownedPool;
          }
        }
      }
      if(pool.length){
        // Escolha ponderada: se personagem exclusivo, dá peso 3x para melhorias da arma exclusiva dentro do pool final
        let pick;
        const __exclusiveCheck = (()=>{ const p = (typeof window!=='undefined' && window.game && window.game.player) ? window.game.player : null; if(!p||!p.characterDef) return null; const m={bastao:'BASTAO',cavaleiro:'ESPADA',motosserra:'MOTOSSERRA',raio_matematico:'RAIO_MATEMATICO',espada:'ESPADA'}; return m[p.characterDef.exclusive]||null; })();
        if(__exclusiveCheck && pool.some(u=> u.weapon===__exclusiveCheck || (u.compatible||[u.weapon]).includes(__exclusiveCheck))){
          // monta array ponderado: exclusivas duplicadas 2x extras (peso 3)
          const weighted=[];
          for(const u of pool){
            const isEx = u.weapon===__exclusiveCheck || (u.compatible||[u.weapon]).includes(__exclusiveCheck);
            weighted.push(u);
            if(isEx){ weighted.push(u); weighted.push(u); }
          }
          pick = weighted[Math.floor(rng()*weighted.length)];
        } else {
          pick = pool[Math.floor(rng()*pool.length)];
        }
        const it = new UpgradeItem(randRange(140, CANVAS_W-140), randRange(100, CANVAS_H-100), pick.id);
        tryPlace(it);
      }
    }
    // Fase 3: leve aumento de chance para itens raros dentro da sala rara (tratado em makeRareRoom)
  }

  spawnSpikes(rng){
    // Espinhos fase 3: 2-5 spikes por sala, posicionamento justo (não bloqueia portas)
    // Não gera em sala inicial
    const count = randInt(2,4 + (this.type==='enemy'?1:0));
    const cx=CANVAS_W/2, cy=CANVAS_H/2;
    for(let i=0;i<count;i++){
      let x,y,tries=0;
      do{
        x=randRange(90, CANVAS_W-90);
        y=randRange(80, CANVAS_H-80);
        tries++;
        // evita centro, portas e paredes
        let bad=false;
        if(dist(x,y,cx,cy) < 80) bad=true;
        // distância mínima de portas
        for(const d of this.getDoorRects()){
          if(dist(x,y, d.x+d.w/2, d.y+d.h/2) < 62) { bad=true; break; }
        }
        for(const w of this.walls) if(rectCollide(x-SPIKE_SIZE/2, y-SPIKE_SIZE/2, SPIKE_SIZE, SPIKE_SIZE, w.x,w.y,w.w,w.h)){ bad=true; break; }
        // evita sobreposição de spikes
        for(const s of this.spikes) if(dist(x,y,s.x,s.y) < 36) { bad=true; break; }
        if(!bad) break;
      }while(tries<18);
      this.spikes.push(new Spike(x,y));
    }
  }

  makeRareRoom(rng){
    if(this.isStart || this.isExit) return false;
    if(this.isRare) return false;
    this.isRare = true;
    this.type = 'rare';
    // limpa spikes centrais para destacar item
    this.spikes = this.spikes.filter(s=> dist(s.x,s.y, CANVAS_W/2, CANVAS_H/2) > 90);
    // paredes internas leves para não poluir sala rara
    // remove um pilar se houver muitos
    if(this.walls.length>6) this.walls.splice(4,1);
    // limpa itens comuns e coloca um raro lendário no centro
    this.items = [];
    // sorteia entre a pool rareItems (fácil expandir)
    const pool = rareItems;
    const pick = pool[Math.floor(rng()*pool.length)];
    let rareItem;
    if(pick==='raio') rareItem = new WeaponItem(CANVAS_W/2, CANVAS_H/2, 'raio');
    else if(pick==='flame_trail') rareItem = new FlameTrailItem(CANVAS_W/2, CANVAS_H/2);
    else if(pick==='swift_boots') rareItem = new SwiftBootsItem(CANVAS_W/2, CANVAS_H/2);
    else if(pick==='double_shot') rareItem = new DoubleShotItem(CANVAS_W/2, CANVAS_H/2);
    else if(pick==='metralhadora') rareItem = new WeaponItem(CANVAS_W/2, CANVAS_H/2, 'metralhadora');
    else if(pick==='power_star') rareItem = new SpecialItemPickup(CANVAS_W/2, CANVAS_H/2, 'power_star');
    else rareItem = new FlameTrailItem(CANVAS_W/2, CANVAS_H/2);
    rareItem.spawnDelay = 120;
    this.items.push(rareItem);
    // sem inimigos na sala rara para ser recompensa justa (ou 1 guardião fraco opcional)
    // deixa vazia para coleta tranquila
    this.enemies = [];
    return true;
  }

  makeMinibossRoom(rng){
    if(this.isStart || this.isExit || this.isRare || this.isMiniboss) return false;
    this.isMiniboss = true;
    this.type = 'miniboss';
    // limpa spikes centrais para arena limpa
    this.spikes = this.spikes.filter(s=> dist(s.x,s.y, CANVAS_W/2, CANVAS_H/2) > 110);
    // remove pilares centrais para dar espaço ao miniboss
    this.walls = this.walls.filter(w => dist(w.x+w.w/2, w.y+w.h/2, CANVAS_W/2, CANVAS_H/2) > 100);
    // garante arena sem itens comuns
    this.items = [];
    this.enemies = [];
    // cria miniboss no centro
    const mb = new Miniboss(CANVAS_W/2, CANVAS_H/2);
    this.enemies.push(mb);
    // marca como não rara para não conflitar
    return true;
  }
  makeBossStairRoom(rng){
    if(this.isStart || this.isRare || this.isMiniboss || this.isBossStair) return false;
    this.isBossStair = true;
    this.isExit = false; // boss arena não é exit portal normal, é arena fechada
    this.type = 'boss_stair';
    // Limpa tudo para arena imponente
    this.spikes = []; // sem espinhos na arena do boss
    // Remove pilares centrais e garante arena limpa no topo e centro
    this.walls = this.walls.filter(w => {
      const wx=w.x+w.w/2, wy=w.y+w.h/2;
      // Mantém paredes externas, remove pilares internos no quadrante superior
      if(dist(wx,wy, CANVAS_W/2, BOSS5_ARENA_Y) < 160) return false;
      if(dist(wx,wy, CANVAS_W/2, CANVAS_H/2) < 90) return false;
      return true;
    });
    this.items = [];
    this.enemies = [];
    // Boss localizado na parte superior da tela (centro-topo)
    const boss = new StairBoss(CANVAS_W/2, BOSS5_ARENA_Y);
    this.enemies.push(boss);
    // Arena fechada visualmente - marca que ainda não derrotado
    this.bossStairDefeated = false;
    this.bossDialogShown = false;
    this.bossFightStarted = false;
    // Hacker: escada corrompida inicialmente BLOQUEADA (fica bloqueada até derrotar Boss Escada, depois desbloqueia)
    this.corruptedStair = {x:CANVAS_W/2, y:CANVAS_H/2+42, w:HACKER_CORRUPTED_STAIR_SIZE_W, h:HACKER_CORRUPTED_STAIR_SIZE_H, active:false, locked:true, anim:0};
    return true;
  }
  makeHackerRoom(rng){
    if(this.isStart || this.isRare || this.isMiniboss || this.isBossStair || this.isHacker || this.isPartyHorde) return false;
    this.isHacker = true;
    this.isExit = false;
    this.type = 'hacker';
    this.hackerDefeated = false;
    this.hackerLocked = false; // quando criado via portal já está desbloqueado; se via grid, locked até stair derrotado
    this.hackerDialogActive = false;
    this.hackerBattleStarted = false;
    // Limpa para arena Dark Vírus
    this.spikes = [];
    this.walls = this.walls.filter(w => {
      const wx=w.x+w.w/2, wy=w.y+w.h/2;
      if(dist(wx,wy, CANVAS_W/2, CANVAS_H/2) < 110) return false;
      return true;
    });
    // paredes temáticas corrompidas: adiciona 2 pilares glitch
    const add=(x,y,w,h)=> this.walls.push({x,y,w,h});
    add(CANVAS_W*0.22-12, CANVAS_H*0.32-12, 24, 24);
    add(CANVAS_W*0.78-12, CANVAS_H*0.32-12, 24, 24);
    this.items = [];
    this.enemies = [];
    const hacker = new HackerBoss(CANVAS_W/2, CANVAS_H/2 - 18);
    this.enemies.push(hacker);
    this.glitchTimer=0;
    this.hackerLocked=false;
    return true;
  }
  generateHackerRewards(){
    const rewards=[];
    rewards.push({type:'heal'}); rewards.push({type:'heal'});
    rewards.push({type:'weapon', weaponType:'motosserra'});
    rewards.push({type:'upgrade', upgradeId:'motosserra_muito_rara_pochita'});
    if(Math.random()<0.60){
      const pool=UPGRADE_DEFS.filter(u=>u.rarity==='MUITO_RARA');
      if(pool.length) rewards.push({type:'upgrade', upgradeId: pool[randInt(0,pool.length-1)].id});
    }
    if(Math.random()<0.50) rewards.push({type:'special', specialId:'power_star'});
    return rewards;
  }
  // Recompensas do boss da escada - muito melhores (vitória Fase 5)
  generateBossStairRewards(){
    const rewards=[];
    // Sempre 2 curas grandes
    rewards.push({type:'heal'}); rewards.push({type:'heal'});
    // Garantido Power Star (recompensa temática)
    rewards.push({type:'special', specialId:'power_star'});
    // 60% bazuca ou raio
    if(Math.random()<0.60) rewards.push({type:'weapon', weaponType:'bazuca'});
    else if(Math.random()<0.50) rewards.push({type:'weapon', weaponType:'raio'});
    // Upgrade muito raro garantido 70%
    if(Math.random()<0.70){
      const pool=UPGRADE_DEFS.filter(u=>u.rarity==='MUITO_RARA');
      if(pool.length) rewards.push({type:'upgrade', upgradeId: pool[randInt(0,pool.length-1)].id});
    }
    // 40% upgrade raro extra
    if(Math.random()<0.40){
      const pool=UPGRADE_DEFS.filter(u=>u.rarity==='RARA');
      if(pool.length) rewards.push({type:'upgrade', upgradeId: pool[randInt(0,pool.length-1)].id});
    }
    return rewards;
  }
  // ===== SALA DE FESTA (HORDA) =====
  makePartyHordeRoom(rng){
    if(this.isStart || this.isExit || this.isRare || this.isMiniboss || this.isBossStair || this.isPartyHorde) return false;
    this.isPartyHorde = true;
    this.type = 'party_horde';
    this.partyHordeDefeated = false;
    this.partyWave = 0;
    this.partyWavesRemaining = PARTY_HORDE_WAVES;
    this.partyWaveTimer = 900; // primeira onda rápida
    this.partyConfetti = [];
    // Limpa spikes e remove pilares centrais para pista de dança
    this.spikes = [];
    this.walls = this.walls.filter(w => dist(w.x+w.w/2, w.y+w.h/2, CANVAS_W/2, CANVAS_H/2) > 110);
    // Sem itens iniciais — recompensa só após limpar
    this.items = [];
    this.enemies = [];
    // Confetti inicial
    for(let i=0;i<28;i++){
      this.partyConfetti.push({
        x: randRange(WALL_THICK+12, CANVAS_W-WALL_THICK-12),
        y: randRange(WALL_THICK+12, CANVAS_H-WALL_THICK-12),
        c: PARTY_COLORS[randInt(0, PARTY_COLORS.length-1)],
        s: randRange(3,7),
        a: randRange(0, Math.PI*2),
        spin: randRange(-0.08,0.08)
      });
    }
    // Spawna primeira onda imediatamente
    this.spawnPartyWave(rng);
    return true;
  }
  spawnPartyWave(rng){
    if(this.partyWavesRemaining <= 0) return;
    const n = randInt(PARTY_HORDE_ENEMIES_MIN, PARTY_HORDE_ENEMIES_MAX);
    // Intensidade aumenta com onda
    const waveIdx = PARTY_HORDE_WAVES - this.partyWavesRemaining; // 0,1,2
    const cx=CANVAS_W/2, cy=CANVAS_H/2;
    for(let i=0;i<n;i++){
      let x,y,tries=0;
      do{
        // Nasce nas bordas da arena para efeito horda entrando
        const edge = randInt(0,3);
        if(edge===0){ x=randRange(WALL_THICK+24, CANVAS_W-WALL_THICK-24); y=WALL_THICK+18; }
        else if(edge===1){ x=randRange(WALL_THICK+24, CANVAS_W-WALL_THICK-24); y=CANVAS_H-WALL_THICK-18; }
        else if(edge===2){ x=WALL_THICK+18; y=randRange(WALL_THICK+24, CANVAS_H-WALL_THICK-24); }
        else { x=CANVAS_W-WALL_THICK-18; y=randRange(WALL_THICK+24, CANVAS_H-WALL_THICK-24); }
        x+=randRange(-18,18); y+=randRange(-18,18);
        tries++;
        let onWall=false;
        for(const w of this.walls) if(rectCollide(x-14,y-14,28,28,w.x,w.y,w.w,w.h)){ onWall=true; break; }
        if(!onWall && dist(x,y,cx,cy)>70) break;
      }while(tries<14);
      // Sorteia tipo — festa tem mais kamikazes e fugitivos para caos
      const roll = rng();
      let e;
      // Escalona dificuldade com floor e onda
      const isHardFloor = this.floor>=3;
      const isFinalWave = waveIdx===PARTY_HORDE_WAVES-1;
      if(isFinalWave && roll < 0.18){
        e = new Summoner(x,y); // chefes de festa na última onda
      } else if(roll < 0.26){
        e = new Kamikaze(x,y);
      } else if(roll < 0.48){
        e = new Fugitive(x,y);
      } else if(roll < 0.62 && isHardFloor){
        e = new DashEnemy(x,y);
      } else {
        e = new Chaser(x,y);
      }
      // Buff leve por onda
      if(waveIdx===1) e.speed *= 1.06;
      if(waveIdx===2) { e.speed *= 1.12; e.hp += 1; e.maxHp = e.hp; }
      // Variação vida/dano (festa também tem)
      applyEnemyVariation(e, rng, this.floor);
      // Cor festiva sutil: não muda lógica, só visual será com chapéu de festa (desenho trata)
      e.isParty = true;
      this.enemies.push(e);
    }
    this.partyWave++;
    this.partyWavesRemaining--;
    this.partyWaveTimer = PARTY_HORDE_WAVE_DELAY;
  }
  generatePartyRewards(){
    const rewards=[];
    // Sempre 1 cura grande + 1 especial aleatório
    rewards.push({type:'heal'});
    if(Math.random()<0.55){
      const pool=['espada_flamejante','escudo_magico','flecha_stand','power_star'];
      rewards.push({type:'special', specialId: pool[randInt(0,pool.length-1)]});
    }
    // 45% arma rara
    if(Math.random()<0.45){
      const pool=['shotgun','raio','metralhadora','carregada'];
      rewards.push({type:'weapon', weaponType: pool[randInt(0,pool.length-1)]});
    }
    // 40% upgrade (inclui muito rara 30% dentro)
    if(Math.random()<0.40){
      const rarity = Math.random()<0.3 ? 'MUITO_RARA' : (Math.random()<0.5 ? 'RARA' : 'INCOMUM');
      const pool=UPGRADE_DEFS.filter(u=>u.rarity===rarity);
      if(pool.length) rewards.push({type:'upgrade', upgradeId: pool[randInt(0,pool.length-1)].id});
    }
    return rewards;
  }
  // Gera recompensas do miniboss - configurável, melhor que salas normais
  // Garantia: sempre dropa 1 melhoria para a arma atualmente equipada (requisito)
  generateMinibossRewards(playerRef){
    const rewards=[];
    // Sempre 1 cura grande
    rewards.push({type:'heal'});
    // --- GARANTIA: 1 melhoria para arma atualmente equipada ---
    let guaranteedId = null;
    try{
      const p = playerRef || (typeof window!=='undefined' && window.game && window.game.player) || null;
      const curName = p && p.weapon ? p.weapon.name : null;
      if(curName){
        // Pool compatível com arma atual que ainda pode subir nível
        let pool = UPGRADE_DEFS.filter(u=>{
          const compat = u.compatible || [u.weapon];
          const isCompat = compat.includes(curName) || u.weapon==='ALL' || compat.includes('ALL') || u.weapon===curName;
          if(!isCompat) return false;
          if(p && typeof p.canAddUpgrade==='function'){
            return p.canAddUpgrade(u.id);
          }
          return true;
        });
        // Fallback: se nada compatível ainda pode subir, tenta qualquer para arma atual (mesmo se max, mas evita duplicata inútil)
        if(pool.length===0){
          const allForWeapon = UPGRADE_DEFS.filter(u=>{
            const compat = u.compatible || [u.weapon];
            return compat.includes(curName) || u.weapon===curName || u.weapon==='ALL' || compat.includes('ALL');
          });
          if(p && typeof p.canAddUpgrade==='function'){
            const canPool = allForWeapon.filter(u=> p.canAddUpgrade(u.id));
            pool = canPool.length ? canPool : [];
          } else {
            pool = allForWeapon;
          }
        }
        // Se ainda vazio (tudo maxado), não garante (evita item não coletável)
        if(pool.length){
          // Prioriza novos upgrades de ESPADA quando arma for ESPADA (75% chance) para showcase
          if(curName==='ESPADA'){
            const newIds=['espada_incomum_corte_vento','espada_rara_guardiao_agil'];
            const newPool=pool.filter(u=> newIds.includes(u.id));
            if(newPool.length && Math.random()<0.75){
              pool=newPool;
            }
          }
          // Escolha aleatória entre os compatíveis ainda não maxados (variedade, sem travar no mesmo MUITO_RARA)
          const pick = pool[randInt(0, pool.length-1)];
          rewards.push({type:'upgrade', upgradeId: pick.id});
          guaranteedId = pick.id;
        }
      }
    }catch(e){ console.warn('miniboss guarantee upgrade failed',e); }
    // Chance 40% Bazuca (muito rara) - prioridade Fase 4
    if(Math.random() < 0.40) rewards.push({type:'weapon', weaponType:'bazuca'});
    else if(Math.random() < 0.30) rewards.push({type:'weapon', weaponType:'raio'});
    else if(Math.random() < 0.25) rewards.push({type:'weapon', weaponType:'metralhadora'});
    // 55% chance de upgrade muito raro (extra, evita duplicar o garantido)
    if(Math.random() < 0.55){
      let pool=UPGRADE_DEFS.filter(u=>u.rarity==='MUITO_RARA');
      // evita duplicar o garantido se já for muito raro da mesma arma
      if(guaranteedId) pool = pool.filter(u=> u.id!==guaranteedId);
      // se player existe, filtra apenas que ainda pode adicionar
      const p = playerRef || (typeof window!=='undefined' && window.game && window.game.player) || null;
      if(p && typeof p.canAddUpgrade==='function'){
        const canPool = pool.filter(u=> p.canAddUpgrade(u.id));
        if(canPool.length) pool = canPool;
      }
      if(pool.length) rewards.push({type:'upgrade', upgradeId: pool[randInt(0,pool.length-1)].id});
    }
    // 35% chance de especial aleatório (inclui flecha)
    if(Math.random() < 0.35){
      const pool=['espada_flamejante','escudo_magico','flecha_stand'];
      rewards.push({type:'special', specialId: pool[randInt(0,pool.length-1)]});
    }
    // Fácil adicionar novos: push({type:'weapon',weaponType:'novaArma',chance:...})
    return rewards;
  }

  placeExitPortal(){
    this.isExit = true;
    this.exitPortal = {
      x: CANVAS_W/2, y: CANVAS_H/2,
      w: 48, h: 36,
      active: false,
      anim: 0
    };
    // garante que não colida com pilar central: remove pilares próximos ao centro
    this.walls = this.walls.filter(w => dist(w.x+w.w/2, w.y+w.h/2, CANVAS_W/2, CANVAS_H/2) > 80);
  }

  isCleared() {
    if(this.isPartyHorde){
      // Festa horda: só limpa após todas as ondas + sem inimigos
      return this.partyHordeDefeated && this.enemies.length === 0;
    }
    return this.enemies.length === 0;
  }
  // para fase: só considera limpa se inimigos zero (itens podem ficar)
  getDoorRects() {
    const rects=[], t=WALL_THICK, cx=CANVAS_W/2, cy=CANVAS_H/2, dw=DOOR_W, dh=DOOR_H;
    if (this.doors.top) rects.push({dir:'top', x: cx - dw/2, y:0, w:dw, h:t+6});
    if (this.doors.bottom) rects.push({dir:'bottom', x: cx - dw/2, y:CANVAS_H - t -6, w:dw, h:t+6});
    if (this.doors.left) rects.push({dir:'left', x:0, y:cy - dh/2, w:t+6, h:dh});
    if (this.doors.right) rects.push({dir:'right', x:CANVAS_W - t -6, y:cy - dh/2, w:t+6, h:dh});
    return rects;
  }

  update(dt, player, bullets, globalParticles, enemyBulletsOut) {
    try{
    // Festa horda: anima confetti e controla ondas (pode aparecer em qualquer fase)
    if(this.isPartyHorde && !this.partyHordeDefeated){
      for(const cf of this.partyConfetti){
        cf.a += cf.spin;
        cf.y += Math.sin(cf.a*0.5)*0.22;
        cf.x += Math.cos(cf.a*0.7)*0.28;
        if(cf.y > CANVAS_H-WALL_THICK-4) cf.y = WALL_THICK+8;
        if(cf.x < WALL_THICK) cf.x = CANVAS_W-WALL_THICK-12;
        if(cf.x > CANVAS_W-WALL_THICK) cf.x = WALL_THICK+12;
      }
      if(this.enemies.length===0 && this.partyWavesRemaining>0){
        this.partyWaveTimer -= dt;
        if(this.partyWaveTimer<=0){
          // rng simples usando Math.random para sorteio de tipos
          const rng = () => Math.random();
          this.spawnPartyWave(rng);
          // partículas de aviso de nova onda
          for(let k=0;k<14;k++) globalParticles.push(new Particle(CANVAS_W/2, CANVAS_H/2-20, randRange(-2,2), randRange(-1.2,0.8), 360, PARTY_COLORS[randInt(0,PARTY_COLORS.length-1)], 2.5));
          if(this.partyWavesRemaining>0){
            // texto flutuante será desenhado no draw
            this._partyNextWaveFlash = 900; // ms para draw mostrar "PRÓXIMA ONDA"
          }
        }
      }
      if(this._partyNextWaveFlash>0) this._partyNextWaveFlash-=dt;
    }
    // atualiza spikes (anim)
    for(const s of this.spikes) s.update(dt);
    // atualiza explosões visuais
    for(let i=this.explosions.length-1;i>=0;i--){
      const ex=this.explosions[i];
      ex.life-=dt;
      ex.radius += dt*0.22; // expande
      if(ex.life<=0) this.explosions.splice(i,1);
    }
    // atualiza auras Farmar Aura (JL) - anel expansivo rosa que segue jogador se follow:true
    if(this.farmarAuras){
      for(let i=this.farmarAuras.length-1;i>=0;i--){
        const fa=this.farmarAuras[i];
        fa.life-=dt;
        if(fa.follow && fa.owner){
          fa.x = fa.owner.x;
          fa.y = fa.owner.y;
        }
        // Expansão suave: nos primeiros 350ms expande rápido, depois mantém maxRadius
        const prog = 1 - clamp(fa.life/fa.maxLife,0,1);
        const expandProg = Math.min(prog*3.2,1);
        fa.radius = lerp(0, fa.maxRadius, expandProg);
        if(fa.life<=0) this.farmarAuras.splice(i,1);
      }
    }

    // inimigos (chaser, fugitive, kamikaze, summoner, miniboss, dash, stair_boss, hacker)
    const pendingSummons=[];
    // Para boss da escada, controlar pausa quando diálogo ainda não iniciado (não ataca/invoca)
    const bossStair = this.enemies.find(e=> e.type==='stair_boss');
    const bossWaitingDialog = bossStair && this.isBossStair && !this.bossFightStarted && !this.bossStairDefeated;
    // Hacker pausa durante diálogo inicial
    const hackerBoss = this.enemies.find(e=> e.type==='hacker');
    const hackerWaitingDialog = hackerBoss && this.isHacker && !hackerBoss.battleStarted && hackerBoss.dialogTimer>0;
    for (const e of this.enemies) {
      if(e.type==='stair_boss'){
        if(bossWaitingDialog) {
          // Só animação leve, não ataca
          e.anim+=dt;
          e.leftHand.anim+=dt;
          e.rightHand.anim+=dt;
          continue;
        }
        e.update(dt, player, this.walls, enemyBulletsOut, pendingSummons, this.enemies, globalParticles, this);
      } else if(e.type==='hacker'){
        // Hacker tem diálogo inicial com Dark Vírus
        if(hackerWaitingDialog){
          // mantém animação mas pausa ataque já feita dentro do hacker update
        }
        e.update(dt, player, this.walls, enemyBulletsOut, pendingSummons, this.enemies, globalParticles, this);
        // glitch code chuva na sala do hacker
        if(this.isHacker && e.battleStarted && Math.random()<0.12){
          const gx=randRange(WALL_THICK+12, CANVAS_W-WALL_THICK-12);
          const gy=WALL_THICK+8;
          globalParticles.push(new Particle(gx, gy, randRange(-0.3,0.3), randRange(1.2,2.4), 420, HACKER_ROOM_GLITCH_COLORS[randInt(0,HACKER_ROOM_GLITCH_COLORS.length-1)], 1.2));
        }
      } else if (e.type==='fugitive') e.update(dt, player, this.walls, enemyBulletsOut);
      else if (e.type==='xshooter') e.update(dt, player, this.walls, enemyBulletsOut);
      else if (e.type==='kamikaze') e.update(dt, player, this.walls);
      else if (e.type==='summoner') e.update(dt, player, this.walls, pendingSummons, this.enemies);
      else if (e.type==='miniboss') e.update(dt, player, this.walls, enemyBulletsOut, pendingSummons, this.enemies, globalParticles);
      else if (e.type==='dash') e.update(dt, player, this.walls);
      else e.update(dt, player, this.walls);
    }
    // Motosserra sangramento: aplica DoT serragem
    for(const e of this.enemies){
      if(e.dead) continue;
      if(e.motosserraBleed && e.motosserraBleed>0){
        e.motosserraBleedTimer = (e.motosserraBleedTimer||0) - dt;
        if(e.motosserraBleedTimer <= 0){
          e.motosserraBleed--;
          e.motosserraBleedTimer = 280;
          const bDmg = e.motosserraBleedDmg || 0.9;
          const diedBleed = e.takeDamage(bDmg);
          e.hitFlash = 120;
          for(let k=0;k<3;k++) globalParticles.push(new Particle(e.x+randRange(-4,4), e.y+randRange(-4,4), randRange(-0.8,0.8), randRange(-0.8,0.4), 220, '#8b0000', 1.8));
          for(let k=0;k<2;k++) globalParticles.push(new Particle(e.x, e.y, randRange(-1,1), -0.9, 180, '#ff3b30', 1.4));
          if(diedBleed){
            for(let k=0;k<10;k++){ const ang=Math.random()*Math.PI*2; globalParticles.push(new Particle(e.x, e.y, Math.cos(ang)*randRange(1.2,3), Math.sin(ang)*randRange(1.2,3), 280, '#ff3b30', 2)); }
            e.motosserraBleed = 0;
          } else {
            // micro empurrão sangramento
            e.x += randRange(-1.2,1.2);
            e.y += randRange(-0.6,0.6);
          }
          if(e.motosserraBleed <= 0){
            e.motosserraBleed = 0;
            delete e.motosserraBleedTimer;
            delete e.motosserraBleedDmg;
          }
        }
      }
    }
    // Hacker sala: glitch timer para efeitos Dark Vírus no chão
    if(this.isHacker){
      this.glitchTimer+=dt;
      if(this.glitchTimer> HACKER_GLITCH_INTERVAL){
        this.glitchTimer=0;
        if(Math.random()<0.45) this.explosions.push({x:randRange(CANVAS_W*0.2,CANVAS_W*0.8), y:randRange(CANVAS_H*0.25,CANVAS_H*0.85), radius:8, life:220, max:220, isHackerGlitch:true});
      }
    }
    // Corrupted Stair portal (bloqueada antes, desbloqueia após Boss Escada)
    if(this.isBossStair){
      if(!this.corruptedStair){
        this.corruptedStair={x:CANVAS_W/2, y:CANVAS_H/2+42, w:HACKER_CORRUPTED_STAIR_SIZE_W, h:HACKER_CORRUPTED_STAIR_SIZE_H, active:false, locked:true, anim:0};
      }
      // Desbloqueia após vitória
      if(this.bossStairDefeated && !this.corruptedStair.active){
        this.corruptedStair.active=true;
        this.corruptedStair.locked=false;
        // flash desbloqueio
        for(let k=0;k<16;k++) globalParticles.push(new Particle(this.corruptedStair.x, this.corruptedStair.y, randRange(-1.4,1.4), randRange(-1.2,0.6), 320, '#00ff88',2));
        this.explosions.push({x:this.corruptedStair.x, y:this.corruptedStair.y, radius:12, life:380, max:380, isHackerGlitch:true});
        if(typeof window!=='undefined' && window.game && window.game.showToast) window.game.showToast('▓ Escada Corrompida desbloqueada! Entre para enfrentar o Hacker ▓', 2200);
      }
      if(this.corruptedStair) this.corruptedStair.anim+=dt*0.003;
      // verifica colisão apenas quando ativa (desbloqueada)
      if(this.corruptedStair && this.corruptedStair.active && !this.hackerDefeated){
        const cs=this.corruptedStair;
        if(rectCollide(player.x-player.w/2, player.y-player.h/2, player.w, player.h, cs.x-cs.w/2, cs.y-cs.h/2, cs.w, cs.h)){
          if(typeof window!=='undefined' && window.game && typeof window.game.enterHackerRoom==='function'){
            window.game.enterHackerRoom();
          }
        }
      } else if(this.corruptedStair && !this.corruptedStair.active){
        // mostra hint quando bloqueada e jogador perto
        const cs=this.corruptedStair;
        if(dist(player.x,player.y,cs.x,cs.y) < 78 && this.bossStairDefeated===false){
          if(typeof window!=='undefined' && window.game && window.game.showToast && Math.random()<0.02){
            // hint raro para não spam
          }
        }
      }
    }
    // injeta invocados (limitado, com vida reduzida)
    for(const ne of pendingSummons){
      // verifica limite global de inimigos na sala para não estourar desempenho
      if(this.enemies.length < 9){
        this.enemies.push(ne);
        for(let k=0;k<8;k++) globalParticles.push(new Particle(ne.x, ne.y, randRange(-1.2,1.2), randRange(-1.2,0.6), 280, '#a78bfa', 2));
      }
    }
    // projéteis player vs inimigos (suporte a pierce do RAIO + Bazuca + Boss Fase 5)
    for (let i=bullets.length-1;i>=0;i--) {
      const b = bullets[i];
      if (b.owner !== 'player') continue;
      if (b.dead && !b.isBazuca) continue;
      if (b.isBazuca && b._exploded) continue;
      let hitThisFrame = false;
      for (let j=this.enemies.length-1;j>=0;j--) {
        const e = this.enemies[j];
        if (e.dead) continue;
        const isPierce = b.pierce;
        const maxPierce = b.pierceCount ?? (isPierce ? 999 : 0);
        if (isPierce && b.hitEnemies.has(e)) continue;
        // ===== BOSS FASE 5: cabeça + mãos com fases =====
        if(e.type==='stair_boss'){
          // Se diálogo ainda não respondido, boss bloqueia todo dano (ainda não começou luta)
          const waitingDialog = this.isBossStair && !this.bossFightStarted && !this.bossStairDefeated;
          if(waitingDialog){
            if(circleRectCollide(b.x,b.y,b.size, e.x - e.w/2 -8, e.y - e.h/2 -8, e.w+16, e.h+16)){
              if(!isPierce) b.dead=true;
              for(let k=0;k<4;k++) globalParticles.push(new Particle(b.x,b.y, randRange(-1,1), randRange(-1,0.6), 180, 'rgba(200,200,210,0.9)', 1.2));
              // Texto aguardando resposta
              hitThisFrame=true;
              if(b.dead) break;
            } else {
              // Tenta mãos também bloqueadas
              let blocked=false;
              for(const hand of e.getHands()){
                if(hand.dead) continue;
                if(circleRectCollide(b.x,b.y,b.size, hand.x-hand.w/2, hand.y-hand.h/2, hand.w, hand.h)){
                  blocked=true; break;
                }
              }
              if(blocked){
                if(!isPierce) b.dead=true;
                for(let k=0;k<3;k++) globalParticles.push(new Particle(b.x,b.y, randRange(-1,1), randRange(-1,0.6), 160, 'rgba(180,180,190,0.85)', 1));
                hitThisFrame=true;
                if(b.dead) break;
              }
            }
            continue;
          }
          let bossHandled=false;
          // Tenta mãos primeiro se estiverem vulneráveis (fase 2)
          const hands=e.getHands();
          for(const hand of hands){
            if(hand.dead) continue;
            if(hand.invulnerable) continue;
            if(circleRectCollide(b.x,b.y,b.size, hand.x-hand.w/2, hand.y-hand.h/2, hand.w, hand.h)){
              if(isPierce){ b.hitEnemies.add(hand); if(b.hitEnemies.size > maxPierce) b.dead=true; } else b.dead=true;
              const diedHand=hand.takeDamage(b.damage);
              for(let k=0;k<6;k++) globalParticles.push(new Particle(hand.x, hand.y, randRange(-2.5,2.5), randRange(-2.5,1), 260, '#ffd700', 3));
              if(diedHand){
                for(let k=0;k<14;k++){ const ang=Math.random()*Math.PI*2; globalParticles.push(new Particle(hand.x,hand.y, Math.cos(ang)*randRange(1.5,4.5), Math.sin(ang)*randRange(1.5,4.5), 400, '#ff8c42', 3)); }
                for(let k=0;k<8;k++) globalParticles.push(new Particle(hand.x,hand.y, randRange(-1.2,1.2), randRange(-1.2,0.6), 320, 'rgba(0,0,0,0.65)', 2));
                // Se ambas mãos mortas, cabeça volta vulnerável (tratado no boss.update checkPhaseEnd, mas feedback já)
                if(e.leftHand.dead && e.rightHand.dead){
                  for(let k=0;k<18;k++){ const ang=Math.random()*Math.PI*2; globalParticles.push(new Particle(e.x,e.y, Math.cos(ang)*randRange(1.4,4), Math.sin(ang)*randRange(1.2,3.8), 420, '#ffd700', 3)); }
                }
              } else {
                const ang=Math.atan2(hand.y - b.y, hand.x - b.x);
                hand.x+=Math.cos(ang)*(b.pierce?3:6); hand.y+=Math.sin(ang)*(b.pierce?3:6);
              }
              // chain pode atingir outra mão ou cabeça? Deixa chain genérico depois
              hitThisFrame=true;
              bossHandled=true;
              break;
            }
          }
          if(bossHandled){
            if(b.dead) break;
            // Se pierce, pode ainda tentar cabeça no mesmo frame? Permitimos continuar para cabeça
          }
          // Tenta cabeça se não invulnerável
          if(!e.isHeadInvulnerable()){
            if(circleRectCollide(b.x,b.y,b.size, e.x - e.w/2, e.y - e.h/2, e.w, e.h)){
              if(isPierce){ b.hitEnemies.add(e); if(b.hitEnemies.size > maxPierce) b.dead=true; } else b.dead=true;
              const died=e.takeDamage(b.damage);
              for(let k=0;k<6;k++) globalParticles.push(new Particle(e.x, e.y, randRange(-3,3), randRange(-4,1), 260, '#ffd700', 3));
              if(died){
                for(let k=0;k<16;k++){ const ang=Math.random()*Math.PI*2; globalParticles.push(new Particle(e.x, e.y, Math.cos(ang)*randRange(1.6,5), Math.sin(ang)*randRange(1.6,5), 480, '#ffd700', 3)); }
              } else {
                const ang=Math.atan2(e.y - b.y, e.x - b.x);
                e.x+=Math.cos(ang)*(b.pierce?3:6); e.y+=Math.sin(ang)*(b.pierce?3:6);
              }
              hitThisFrame=true;
              if(b.dead) break;
            }
          } else {
            // Cabeça bloqueada: fase2 = bloqueio total com faísca cinza; fase3 fora da janela = chip damage reduzido (28%)
            if(circleRectCollide(b.x,b.y,b.size, e.x - e.w/2 -6, e.y - e.h/2 -6, e.w+12, e.h+12)){
              if(e.phase===3 && e.vulnWindow<=0){
                // Chip damage: permite acertar mas com feedback de escudo (cinza + dourado)
                if(isPierce){ b.hitEnemies.add(e); if(b.hitEnemies.size > maxPierce) b.dead=true; } else b.dead=true;
                const died=e.takeDamage(b.damage);
                // partículas mistas: cinza escudo + faísca dourada reduzida
                for(let k=0;k<3;k++) globalParticles.push(new Particle(b.x,b.y, randRange(-1.2,1.2), randRange(-1.2,0.6), 160, 'rgba(180,180,190,0.9)', 1.3));
                for(let k=0;k<3;k++) globalParticles.push(new Particle(e.x, e.y, randRange(-1.2,1.2), randRange(-1,0.4), 150, 'rgba(255,215,0,0.55)', 1.5));
                if(died){
                  for(let k=0;k<16;k++){ const ang=Math.random()*Math.PI*2; globalParticles.push(new Particle(e.x, e.y, Math.cos(ang)*randRange(1.6,5), Math.sin(ang)*randRange(1.6,5), 480, '#ffd700', 3)); }
                }
                hitThisFrame=true;
                if(b.dead) break;
              } else {
                if(!isPierce) b.dead=true; // projétil é bloqueado
                for(let k=0;k<4;k++) globalParticles.push(new Particle(b.x,b.y, randRange(-1.2,1.2), randRange(-1.2,0.6), 180, 'rgba(180,180,190,0.9)', 1.5));
                hitThisFrame=true;
                if(b.dead) break;
              }
            }
          }
          continue; // já tratou boss, pula lógica genérica
        }
        // ===== HACKER - Boss final secreto (mesmo tamanho do jogador, corrompido) =====
        if(e.type==='hacker'){
          // Diálogo ainda não iniciado? Bloqueia dano mas mostra faísca
          if(!e.battleStarted){
            if(circleRectCollide(b.x,b.y,b.size, e.x - e.w/2 -4, e.y - e.h/2 -4, e.w+8, e.h+8)){
              if(!isPierce) b.dead=true;
              for(let k=0;k<3;k++) globalParticles.push(new Particle(b.x,b.y, randRange(-1,1), randRange(-1,0.6), 160, 'rgba(0,255,136,0.85)',1.2));
              hitThisFrame=true;
              if(b.dead) break;
            }
            continue;
          }
          if(circleRectCollide(b.x,b.y,b.size, e.x - e.w/2, e.y - e.h/2, e.w, e.h)){
            if(isPierce){ b.hitEnemies.add(e); if(b.hitEnemies.size > maxPierce) b.dead=true; } else b.dead=true;
            const died=e.takeDamage(b.damage);
            for(let k=0;k<6;k++) globalParticles.push(new Particle(e.x, e.y, randRange(-2.5,2.5), randRange(-2.5,1), 260, '#00ff88', 3));
            if(died){
              for(let k=0;k<18;k++){ const ang=Math.random()*Math.PI*2; globalParticles.push(new Particle(e.x, e.y, Math.cos(ang)*randRange(1.4,4.5), Math.sin(ang)*randRange(1.4,4.5), 480, '#00ff88', 3)); }
              for(let k=0;k<10;k++) globalParticles.push(new Particle(e.x, e.y, randRange(-1.2,1.2), randRange(-1.2,0.6), 340, '#ffffff', 2));
            } else {
              const ang=Math.atan2(e.y - b.y, e.x - b.x);
              e.x+=Math.cos(ang)*(b.pierce?4:8); e.y+=Math.sin(ang)*(b.pierce?4:8);
              // glitch no hacker ao ser atingido
              for(let k=0;k<3;k++) globalParticles.push(new Particle(e.x, e.y, randRange(-1.2,1.2), randRange(-1,0.6), 160, '#ff0040',1.4));
            }
            // chain para hacker? permite mas reduzido
            if(b.chain>0 && !died){
              let chainLeft=b.chain;
              for(const other of this.enemies){
                if(chainLeft<=0) break;
                if(other===e || other.dead) continue;
                if(b.hitEnemies.has(other)) continue;
                if(other.type==='hacker' || other.type==='stair_boss') continue;
                if(dist(e.x,e.y, other.x, other.y) < 88){
                  const cDmg=b.damage*0.5;
                  const cDied=other.takeDamage(cDmg);
                  b.hitEnemies.add(other);
                  for(let k=0;k<4;k++) globalParticles.push(new Particle(other.x, other.y, randRange(-1.2,1.2), randRange(-1.2,0.5), 220, '#00e5ff',2));
                  chainLeft--;
                }
              }
            }
            hitThisFrame=true;
            if(b.dead) break;
          }
          continue;
        }
        if (circleRectCollide(b.x,b.y,b.size, e.x - e.w/2, e.y - e.h/2, e.w, e.h)) {
          if(isPierce){
            b.hitEnemies.add(e);
            if(b.hitEnemies.size > maxPierce) b.dead = true;
          } else b.dead = true;
          const died = e.takeDamage(b.damage);
          for(let k=0;k<6;k++) globalParticles.push(new Particle(e.x, e.y, randRange(-3,3), randRange(-4,1), 260, e.type==='fugitive'?'#c084fc':'#ff6b6b', 3));
          if (died) {
            for(let k=0;k<14;k++) { const ang=Math.random()*Math.PI*2, sp=randRange(1.5,5); globalParticles.push(new Particle(e.x, e.y, Math.cos(ang)*sp, Math.sin(ang)*sp, randRange(300,500), e.type==='fugitive'?'#a78bfa':(randInt(0,1)?'#ff3b30':'#ffcc00'), randInt(3,5))); }
            if (Math.random() < 0.22) {
              const healAmt = Math.random()<0.75 ? 1 : 2;
              const it = new HealingItem(e.x + randRange(-8,8), e.y + randRange(-8,8), healAmt);
              it.spawnDelay = 320;
              this.items.push(it);
            }
          } else {
            const ang = Math.atan2(e.y - b.y, e.x - b.x);
            e.x += Math.cos(ang)*(b.pierce?4:8); e.y += Math.sin(ang)*(b.pierce?4:8);
          }
          // cadeia elétrica (RAIO MUITO_RARA) - atinge alvos próximos com 50% dano
          if(b.chain>0){
            let chainLeft = b.chain;
            for(const other of this.enemies){
              if(chainLeft<=0) break;
              if(other===e || other.dead) continue;
              if(b.hitEnemies.has(other)) continue;
              if(other.type==='stair_boss') continue; // não chain para boss complexo (evita bug)
              if(dist(e.x,e.y, other.x, other.y) < 88){
                const cDmg = b.damage * 0.5;
                const cDied = other.takeDamage(cDmg);
                b.hitEnemies.add(other);
                for(let k=0;k<4;k++) globalParticles.push(new Particle(other.x, other.y, randRange(-1.5,1.5), randRange(-1.5,0.5), 220, '#00e5ff', 2));
                // arco visual
                globalParticles.push(new Particle((e.x+other.x)/2, (e.y+other.y)/2, randRange(-0.5,0.5), randRange(-0.5,0.5), 160, 'rgba(0,229,255,0.9)', 1));
                if(cDied){
                  for(let k=0;k<10;k++){ const ang=Math.random()*Math.PI*2; globalParticles.push(new Particle(other.x, other.y, Math.cos(ang)*randRange(1.2,3), Math.sin(ang)*randRange(1.2,3), 280, '#00e5ff', 2)); }
                } else {
                  const ang=Math.atan2(other.y-e.y, other.x-e.x);
                  other.x+=Math.cos(ang)*3; other.y+=Math.sin(ang)*3;
                }
                chainLeft--;
              }
            }
          }
          hitThisFrame = true;
          if(b.dead) break;
          // para pierce limitado, continua até limite; hitThisFrame já marca
        }
      }
      // BAZUCA: explosão em área (NÃO atinge jogador - regra importante)
      if(b.isBazuca && (hitThisFrame || b.dead)){
        if(!b._exploded){
          b._exploded=true;
          // evita dupla explosão quando já explodiu no hitThisFrame
          const expR = b.explosionRadius || WEAPON_BAZUCA.explosionRadius;
          const expD = b.explosionDamage || WEAPON_BAZUCA.explosionDamage;
          this.explosions.push({x:b.x, y:b.y, radius: 16, life: 420, max: 420, isBazuca:true, radiusTarget: expR});
          for(let k=0;k<28;k++){ const ang=Math.random()*Math.PI*2, sp=randRange(2.8,7.2); const col=['#ff3b30','#ff6a00','#ffcc00','#ff8c42'][randInt(0,3)]; globalParticles.push(new Particle(b.x, b.y, Math.cos(ang)*sp, Math.sin(ang)*sp, randRange(320,560), col, randInt(3,6))); }
          for(let k=0;k<16;k++) globalParticles.push(new Particle(b.x, b.y, randRange(-1.8,1.8), randRange(-1.8,0.6), 380, '#ffffff', 2.5));
          for(let k=0;k<8;k++) globalParticles.push(new Particle(b.x, b.y, randRange(-1.2,1.2), randRange(-1.2,0.4), 420, 'rgba(0,0,0,0.85)', 2));
          // dano em área com falloff (100% centro -> 50% borda) - suporta boss fase 5 (cabeça + mãos) - bloqueia antes da luta
          for(const other of this.enemies){
            if(other.dead) continue;
            if(other.type==='stair_boss'){
              if(this.isBossStair && !this.bossFightStarted && !this.bossStairDefeated) continue; // bloqueia dano antes do diálogo
              // Testa cabeça
              let dHead=dist(b.x,b.y, other.x, other.y);
              if(dHead < expR){
                const falloff = 1 - (dHead / expR) * 0.5;
                const dmg = expD * falloff;
                // Cabeça: fase2 bloqueia total, fase3 fora da janela = chip reduzido (justo)
                if(!other.isHeadInvulnerable()){
                  const died=other.takeDamage(dmg);
                  for(let k=0;k<5;k++) globalParticles.push(new Particle(other.x, other.y, randRange(-1.8,1.8), randRange(-1.2,0.5), 260, '#ff3b30', 2));
                  if(died){
                    for(let k=0;k<12;k++){const ang2=Math.random()*Math.PI*2; globalParticles.push(new Particle(other.x, other.y, Math.cos(ang2)*randRange(1.4,4), Math.sin(ang2)*randRange(1.2,3), 320, '#ff6a00', 3));}
                  }
                } else if(other.phase===3 && other.vulnWindow<=0){
                  const died=other.takeDamage(dmg);
                  for(let k=0;k<3;k++) globalParticles.push(new Particle(b.x,b.y, randRange(-1,1), randRange(-1,0.6), 150, 'rgba(180,180,190,0.85)', 1.2));
                  for(let k=0;k<2;k++) globalParticles.push(new Particle(other.x, other.y, randRange(-1.2,1.2), randRange(-1,0.4), 150, 'rgba(255,215,0,0.45)', 1.3));
                  if(died){
                    for(let k=0;k<12;k++){const ang2=Math.random()*Math.PI*2; globalParticles.push(new Particle(other.x, other.y, Math.cos(ang2)*randRange(1.4,4), Math.sin(ang2)*randRange(1.2,3), 320, '#ffd700', 3));}
                  }
                } else {
                  for(let k=0;k<3;k++) globalParticles.push(new Particle(b.x,b.y, randRange(-1,1), randRange(-1,0.6), 160, 'rgba(180,180,190,0.9)', 1.5));
                }
              }
              // Testa mãos
              for(const hand of other.getHands()){
                if(hand.dead) continue;
                if(hand.invulnerable) continue;
                const dHand=dist(b.x,b.y, hand.x, hand.y);
                if(dHand < expR){
                  const falloff = 1 - (dHand / expR) * 0.5;
                  const dmg = expD * falloff;
                  const died=hand.takeDamage(dmg);
                  for(let k=0;k<5;k++) globalParticles.push(new Particle(hand.x, hand.y, randRange(-1.8,1.8), randRange(-1.2,0.5), 260, '#ff8c42', 2));
                  if(died){
                    for(let k=0;k<10;k++){const ang2=Math.random()*Math.PI*2; globalParticles.push(new Particle(hand.x, hand.y, Math.cos(ang2)*randRange(1.2,3), Math.sin(ang2)*randRange(1.2,3), 280, '#ffd700', 2));}
                  }
                }
              }
              continue;
            }
            const d=dist(b.x,b.y, other.x, other.y);
            if(d < expR){
              const falloff = 1 - (d / expR) * 0.5; // 1.0 no centro, 0.5 na borda
              const dmg = expD * falloff;
              const died=other.takeDamage(dmg);
              const ang=Math.atan2(other.y - b.y, other.x - b.x) || Math.random()*Math.PI*2;
              other.x+=Math.cos(ang)*(6 + falloff*10);
              other.y+=Math.sin(ang)*(6 + falloff*10);
              for(let k=0;k<5;k++) globalParticles.push(new Particle(other.x, other.y, randRange(-1.8,1.8), randRange(-1.2,0.5), 260, '#ff3b30', 2));
              if(died){
                for(let k=0;k<12;k++){const ang2=Math.random()*Math.PI*2; globalParticles.push(new Particle(other.x, other.y, Math.cos(ang2)*randRange(1.4,4), Math.sin(ang2)*randRange(1.2,3), 320, '#ff6a00', 3));}
              }
            }
          }
          // NÃO causa dano ao jogador (regra)
          b.dead=true;
        }
      }
      // efeito visual extra para raio perfurante ao acertar
      if(hitThisFrame && b.pierce){
        for(let k=0;k<3;k++) globalParticles.push(new Particle(b.x,b.y, randRange(-1,1), randRange(-1,1), 180, '#00e5ff', 2));
      }
      // efeito cadeia visual extra
      if(hitThisFrame && b.chain>0){
        for(let k=0;k<2;k++) globalParticles.push(new Particle(b.x,b.y, randRange(-1.2,1.2), randRange(-1.2,0.8), 140, '#ffd700', 2));
      }
    }
    // Kamikaze explode ao morrer (uma única vez) - causa dano em área em inimigos e jogador
    for(const e of this.enemies){
      if(e.type==='kamikaze' && e.dead && !e.exploded){
        e.exploded = true;
        // cria explosão visual (maior se brutal/elite)
        this.explosions.push({x:e.x, y:e.y, radius: 14, life: explosionDuration, max: explosionDuration, isKamikazeVariation: e.variation});
        // partículas explosão laranja/vermelho/amarelo
        for(let k=0;k<22;k++){ const ang=Math.random()*Math.PI*2, sp=randRange(2,6); const col=['#ff3b00','#ff8c00','#ffcc00','#ff6a00'][randInt(0,3)]; globalParticles.push(new Particle(e.x, e.y, Math.cos(ang)*sp, Math.sin(ang)*sp, randRange(300,520), col, randInt(3,6))); }
        for(let k=0;k<10;k++){ const ang=Math.random()*Math.PI*2; globalParticles.push(new Particle(e.x, e.y, Math.cos(ang)*randRange(1,3), Math.sin(ang)*randRange(1,3), 400, 'rgba(0,0,0,0.9)', 2)); }
        // dano em área: inimigos próximos (estratégico)
        for(const other of this.enemies){
          if(other===e || other.dead) continue;
          const expR_other = e.explosionRadius || explosionRadius;
          const expD_other = e.explosionDamage || explosionDamage;
          if(dist(e.x,e.y, other.x, other.y) < expR_other){
            const died2 = other.takeDamage(expD_other);
            for(let k=0;k<5;k++) globalParticles.push(new Particle(other.x, other.y, randRange(-2,2), randRange(-2,0), 260, '#ff6a00', 2));
            if(died2){
              for(let k=0;k<12;k++){ const ang=Math.random()*Math.PI*2; globalParticles.push(new Particle(other.x, other.y, Math.cos(ang)*randRange(1.4,4), Math.sin(ang)*randRange(1,4), 300, '#ff3b00', 3)); }
            }
          }
        }
        // dano no jogador se dentro do raio (variação brutal tem raio/dano maior)
        const expR = e.explosionRadius || explosionRadius;
        const expD = e.explosionDamage || explosionDamage;
        if(dist(e.x,e.y, player.x, player.y) < expR + 12){
          if(!player.isInvulnerable()){
            if(player.takeDamage(expD)){
              for(let k=0;k<12;k++) globalParticles.push(new Particle(player.x, player.y, randRange(-3,3), randRange(-3,1), 360, '#ff3b00', 3));
            }
          }
        }
      }
    }
    // remove mortos (inclui kamikazes já explodidos)
    this.enemies = this.enemies.filter(e => !e.dead);

    // Power Star ⭐ - dano por toque quando invencível (reutiliza colisão, sem quebrar sistema)
    if(player.powerStarActive){
      for(const e of this.enemies){
        if(e.dead) continue;
        // Boss Fase 5 tem colisões especiais: cabeça + mãos (bloqueia antes da luta)
        if(e.type==='stair_boss'){
          if(this.isBossStair && !this.bossFightStarted && !this.bossStairDefeated) continue; // diálogo ainda não respondido, sem dano
          // Testa cabeça sempre (se tocar, danifica)
          if(!e.isHeadInvulnerable()){
            if(rectCollide(player.x - player.w/2, player.y - player.h/2, player.w, player.h, e.x - e.w/2, e.y - e.h/2, e.w, e.h)){
              const timer = player.powerStarHitTimers.get(e) || 0;
              if(timer<=0){
                const died=e.takeDamage(player.powerStarDamage);
                player.powerStarHitTimers.set(e, POWER_STAR_TOUCH_INTERVAL);
                for(let k=0;k<8;k++) globalParticles.push(new Particle(e.x, e.y, randRange(-2,2), randRange(-2,0.5), 240, '#ffd700', 2));
                if(died){
                  for(let k=0;k<18;k++){ const ang=Math.random()*Math.PI*2; globalParticles.push(new Particle(e.x,e.y, Math.cos(ang)*randRange(1.4,4), Math.sin(ang)*randRange(1.4,4), 420, '#ffd700', 3)); }
                } else {
                  const ang=Math.atan2(e.y - player.y, e.x - player.x);
                  e.x+=Math.cos(ang)*8; e.y+=Math.sin(ang)*8;
                }
              }
            }
          }
          // Mãos vulneráveis também levam dano por contato Power Star
          for(const hand of e.getHands()){
            if(hand.dead) continue;
            if(hand.invulnerable) continue;
            if(rectCollide(player.x - player.w/2, player.y - player.h/2, player.w, player.h, hand.x-hand.w/2, hand.y-hand.h/2, hand.w, hand.h)){
              const timer = player.powerStarHitTimers.get(hand) || 0;
              if(timer<=0){
                const died=hand.takeDamage(player.powerStarDamage);
                player.powerStarHitTimers.set(hand, POWER_STAR_TOUCH_INTERVAL);
                for(let k=0;k<6;k++) globalParticles.push(new Particle(hand.x, hand.y, randRange(-1.5,1.5), randRange(-1.5,0.6), 240, '#ffd700', 2));
                if(died){
                  for(let k=0;k<12;k++){ const ang=Math.random()*Math.PI*2; globalParticles.push(new Particle(hand.x, hand.y, Math.cos(ang)*randRange(1.2,3), Math.sin(ang)*randRange(1.2,3), 340, '#ff8c42', 2)); }
                }
              }
            }
          }
          continue;
        }
        // Inimigos normais
        const isColliding = rectCollide(player.x - player.w/2, player.y - player.h/2, player.w, player.h, e.x - e.w/2, e.y - e.h/2, e.w, e.h);
        // Para miniboss e dash, também usa rect
        // Para inimigos grandes, já cobre
        if(isColliding){
          const timer = player.powerStarHitTimers.get(e) || 0;
          if(timer<=0){
            const died=e.takeDamage(player.powerStarDamage);
            player.powerStarHitTimers.set(e, POWER_STAR_TOUCH_INTERVAL);
            for(let k=0;k<6;k++) globalParticles.push(new Particle(e.x, e.y, randRange(-1.4,1.4), randRange(-1.4,0.6), 240, '#ffd700', 2));
            for(let k=0;k<3;k++) globalParticles.push(new Particle(player.x, player.y, randRange(-1,1), randRange(-1,0.6), 200, '#fff8a0', 1.5));
            if(died){
              for(let k=0;k<12;k++){ const ang=Math.random()*Math.PI*2; globalParticles.push(new Particle(e.x,e.y, Math.cos(ang)*randRange(1.2,3.5), Math.sin(ang)*randRange(1.2,3.5), 340, '#ffd700', 3)); }
              if(Math.random()<0.14){
                const healAmt=Math.random()<0.72?1:2;
                const it=new HealingItem(e.x+randRange(-6,6), e.y+randRange(-6,6), healAmt);
                it.spawnDelay=300; this.items.push(it);
              }
            } else {
              const ang=Math.atan2(e.y - player.y, e.x - player.x);
              e.x+=Math.cos(ang)*9; e.y+=Math.sin(ang)*9;
            }
          }
        }
      }
      // Mantém limpeza de mortos após Power Star
      this.enemies = this.enemies.filter(e=> !e.dead);
    }

    // Miniboss - recompensa e liberação arena (Fase 4)
    if(this.isMiniboss && !this.minibossDefeated && this.enemies.length===0){
      this.minibossDefeated=true;
      // Indicação clara de vitória: explosão central dourada
      for(let k=0;k<36;k++){ const ang=Math.random()*Math.PI*2, sp=randRange(2.2,6.5); const col=['#ffd700','#ffcc00','#d946ef','#a78bfa'][randInt(0,3)]; globalParticles.push(new Particle(CANVAS_W/2, CANVAS_H/2, Math.cos(ang)*sp, Math.sin(ang)*sp, randRange(400,720), col, randInt(3,6))); }
      for(let k=0;k<20;k++) globalParticles.push(new Particle(CANVAS_W/2, CANVAS_H/2, randRange(-1.8,1.8), randRange(-1.8,0.6), 520, '#ffffff', 2.5));
      this.explosions.push({x:CANVAS_W/2, y:CANVAS_H/2, radius:20, life:600, max:600, isMinibossDeath:true});
      // Gera recompensas configuráveis (muito raras) - passa player para garantir melhoria da arma equipada
      const rewards=this.generateMinibossRewards(player);
      // Toast informativo sobre melhoria garantida
      try{
        const curW2 = player && player.weapon ? player.weapon.name : null;
        const upReward2 = rewards.find(r=> r.type==='upgrade');
        if(upReward2 && curW2){
          const def2 = UPGRADE_MAP.get(upReward2.upgradeId);
          if(def2){
            const compat2 = def2.compatible || [def2.weapon];
            const isForCur2 = compat2.includes(curW2) || def2.weapon===curW2 || def2.weapon==='ALL' || compat2.includes('ALL');
            if(isForCur2 && typeof window!=='undefined' && window.game && window.game.showToast){
              window.game.showToast(`★ Miniboss dropou melhoria para ${curW2}: ${def2.name}!`, 2800);
            }
          }
        }
      }catch(e){}
      for(const rw of rewards){
        let rx,ry,tries=0;
        do{
          rx=randRange(140, CANVAS_W-140); ry=randRange(110, CANVAS_H-110); tries++;
          let onWall=false; for(const w of this.walls) if(rectCollide(rx-12,ry-12,24,24,w.x,w.y,w.w,w.h)) onWall=true;
          if(!onWall && dist(rx,ry, CANVAS_W/2, CANVAS_H/2)>40) break;
        }while(tries<14);
        let it=null;
        if(rw.type==='weapon' && rw.weaponType==='bazuca') it=new WeaponItem(rx,ry,'bazuca');
        else if(rw.type==='weapon') it=new WeaponItem(rx,ry,rw.weaponType);
        else if(rw.type==='special') it=new SpecialItemPickup(rx,ry,rw.specialId);
        else if(rw.type==='upgrade') it=new UpgradeItem(rx,ry,rw.upgradeId);
        else it=new HealingItem(rx,ry,2);
        if(it){ it.spawnDelay=420; this.items.push(it); }
      }
    }

    // rastros de fogo - atualiza e causa dano periódico (não afeta jogador)
    for(let i=this.fires.length-1;i>=0;i--){
      const f=this.fires[i];
      if(!f.update(dt)){ this.fires.splice(i,1); continue; }
      if(f.canTick()){
        let hitSomeone=false;
        for(const e of this.enemies){
          if(e.dead) continue;
          const d=dist(f.x,f.y,e.x,e.y);
          if(d < f.radius + e.w*0.42){
            const died=e.takeDamage(f.damage);
            for(let k=0;k<4;k++) globalParticles.push(new Particle(e.x,e.y, randRange(-1.2,1.2), randRange(-1.8,0), 200, '#ff8c00', 2));
            if(died){
              for(let k=0;k<12;k++){ const ang=Math.random()*Math.PI*2; globalParticles.push(new Particle(e.x,e.y, Math.cos(ang)*randRange(1,3), Math.sin(ang)*randRange(1,3), 320, '#ff6a00', 3)); }
              if(Math.random()<0.14){
                const healAmt=Math.random()<0.72?1:2;
                const it=new HealingItem(e.x+randRange(-6,6), e.y+randRange(-6,6), healAmt);
                it.spawnDelay=300; this.items.push(it);
              }
            } else {
              const ang=Math.atan2(e.y - f.y, e.x - f.x);
              e.x+=Math.cos(ang)*2.2; e.y+=Math.sin(ang)*2.2;
            }
            hitSomeone=true;
          }
        }
        if(hitSomeone){
          f.resetTick();
          for(let k=0;k<3;k++) globalParticles.push(new Particle(f.x+randRange(-7,7), f.y+randRange(-6,6), randRange(-0.7,0.7), randRange(-1.1,-0.2), 240, '#ffcc00', 2));
        }
      }
    }

    // espinhos: dano periódico com cooldown ( fase 3 )
    // inicializa timer no player se não existir
    if(player.spikeTimer===undefined) player.spikeTimer=0;
    if(player.spikeTimer>0) player.spikeTimer-=dt;
    for(const s of this.spikes){
      if(s.collides(player) && player.spikeTimer<=0 && !player.isInvulnerable()){
        if(player.takeDamage(s.damage)){
          player.spikeTimer = spikeCooldown;
          player.invulnTimer = Math.max(player.invulnTimer, 380);
          for(let k=0;k<9;k++) globalParticles.push(new Particle(player.x, player.y, randRange(-2.2,2.2), randRange(-2.5,0), 340, '#ff3b30', 2));
          for(let k=0;k<6;k++) globalParticles.push(new Particle(s.x, s.y, randRange(-1.5,1.5), randRange(-2,0), 260, '#ff6a00', 2));
        }
      }
      // opcional: inimigos também podem sofrer dano de espinhos (balanceado: kamikazes e chasers levam dano leve)
      // Mantemos: apenas kamikazes e chasers levam 0.5 do dano para não punir fugitive/summoner que já fogem
      // Para simplicidade e performance, não aplicamos dano a inimigos nos espinhos (melhor balanceamento)
    }

    // Boss Fase 5 - vitória: quando cabeça chega a 0, para ataques e mostra efeito de vitória
    if(this.isBossStair && !this.bossStairDefeated){
      const boss=this.enemies.find(e=> e.type==='stair_boss');
      if(!boss){
        // Boss morto e removido (ou nunca existiu?). isBossStair ainda true mas sem boss = vitória
        // Se enemies vazio após morte, marca vitória
        if(this.enemies.length===0){
          this.bossStairDefeated=true;
          // Explosão de vitória grande - conclusão Fase 5
          for(let k=0;k<48;k++){ const ang=Math.random()*Math.PI*2, sp=randRange(2.4,7.2); const col=['#ffd700','#fff8a0','#ff8c42','#ffffff'][randInt(0,3)]; globalParticles.push(new Particle(CANVAS_W/2, CANVAS_H/2-20, Math.cos(ang)*sp, Math.sin(ang)*sp, randRange(420,760), col, randInt(3,6))); }
          for(let k=0;k<24;k++) globalParticles.push(new Particle(CANVAS_W/2, CANVAS_H/2-20, randRange(-1.8,1.8), randRange(-1.8,0.6), 560, '#ffffff', 2.5));
          this.explosions.push({x:CANVAS_W/2, y:BOSS5_ARENA_Y, radius:24, life:800, max:800, isBossStairDeath:true});
          this.explosions.push({x:CANVAS_W/2-40, y:BOSS5_ARENA_Y+30, radius:16, life:600, max:600, isBossStairDeath:true});
          this.explosions.push({x:CANVAS_W/2+40, y:BOSS5_ARENA_Y+30, radius:16, life:600, max:600, isBossStairDeath:true});
          // Recompensas Fase 5
          const rewards=this.generateBossStairRewards();
          for(const rw of rewards){
            let rx,ry,tries=0;
            do{
              rx=randRange(140, CANVAS_W-140); ry=randRange(BOSS5_ARENA_Y+60, CANVAS_H-80); tries++;
              let onWall=false; for(const w of this.walls) if(rectCollide(rx-12,ry-12,24,24,w.x,w.y,w.w,w.h)) onWall=true;
              if(!onWall) break;
            }while(tries<16);
            let it=null;
            if(rw.type==='weapon') it=new WeaponItem(rx,ry,rw.weaponType);
            else if(rw.type==='special') it=new SpecialItemPickup(rx,ry,rw.specialId);
            else if(rw.type==='upgrade') it=new UpgradeItem(rx,ry,rw.upgradeId);
            else it=new HealingItem(rx,ry,2);
            if(it){ it.spawnDelay=480; this.items.push(it); }
          }
          // Cria portal de saída após vitória para concluir fase 5 (ou vitória total se floor===5 for final)
          this.placeExitPortal();
          this.exitPortal.active=true;
          this.exitPortal.x=CANVAS_W/2; this.exitPortal.y=CANVAS_H/2+40;
          // Mantém arena liberada: portas destravam (isCleared true)
        }
      } else {
        // Se boss existe mas está morto (hp 0) - marca para remoção no próximo frame, mas já mostra efeito parcial
        if(boss.dead && !this._bossDeathFxDone){
          this._bossDeathFxDone=true;
          for(let k=0;k<32;k++){ const ang=Math.random()*Math.PI*2; globalParticles.push(new Particle(boss.x,boss.y, Math.cos(ang)*randRange(2,6), Math.sin(ang)*randRange(2,6), 500, '#ffd700', 3)); }
          this.explosions.push({x:boss.x, y:boss.y, radius:18, life:520, max:520, isBossStairDeath:true});
        }
        // Remove boss morto após animação curta (1.2s) para trigger vitória acima
        if(boss.dead && boss.victoryTimer>1200){
          const idx=this.enemies.indexOf(boss);
          if(idx!==-1) this.enemies.splice(idx,1);
          this._bossDeathFxDone=false;
        }
      }
      // Gera escada corrompida após vitória stair (se hacker ainda não derrotado)
      if(this.isBossStair && this.bossStairDefeated && !this.corruptedStair){
        this.corruptedStair={x:CANVAS_W/2, y:CANVAS_H/2+42, w:HACKER_CORRUPTED_STAIR_SIZE_W, h:HACKER_CORRUPTED_STAIR_SIZE_H, active:true, anim:0, locked:false};
      }
    }

    // Hacker - vitória final secreta (Dark Vírus)
    if(this.isHacker && !this.hackerDefeated){
      const hacker=this.enemies.find(e=> e.type==='hacker');
      if(!hacker){
        if(this.enemies.length===0){
          this.hackerDefeated=true;
          // Mensagem final requisitada
          for(let k=0;k<52;k++){ const ang=Math.random()*Math.PI*2, sp=randRange(2.4,7.8); const col=['#00ff88','#00e5ff','#ffffff','#c084fc'][randInt(0,3)]; globalParticles.push(new Particle(CANVAS_W/2, CANVAS_H/2, Math.cos(ang)*sp, Math.sin(ang)*sp, randRange(420,820), col, randInt(3,6))); }
          for(let k=0;k<26;k++) globalParticles.push(new Particle(CANVAS_W/2, CANVAS_H/2, randRange(-1.8,1.8), randRange(-1.8,0.6), 620, '#ffffff', 2.6));
          this.explosions.push({x:CANVAS_W/2, y:CANVAS_H/2, radius:24, life:800, max:800, isHackerDeath:true});
          this.explosions.push({x:CANVAS_W/2-36, y:CANVAS_H/2+12, radius:16, life:600, max:600, isHackerDeath:true});
          this.explosions.push({x:CANVAS_W/2+36, y:CANVAS_H/2+12, radius:16, life:600, max:600, isHackerDeath:true});
          const rewards=this.generateHackerRewards();
          for(const rw of rewards){
            let rx,ry,tries=0;
            do{
              rx=randRange(140, CANVAS_W-140); ry=randRange(120, CANVAS_H-120); tries++;
              let onWall=false; for(const w of this.walls) if(rectCollide(rx-12,ry-12,24,24,w.x,w.y,w.w,w.h)) onWall=true;
              if(!onWall && dist(rx,ry,CANVAS_W/2,CANVAS_H/2)>46) break;
            }while(tries<16);
            let it=null;
            if(rw.type==='weapon') it=new WeaponItem(rx,ry,rw.weaponType);
            else if(rw.type==='upgrade') it=new UpgradeItem(rx,ry,rw.upgradeId);
            else if(rw.type==='special') it=new SpecialItemPickup(rx,ry,rw.specialId);
            else it=new HealingItem(rx,ry,2);
            if(it){ it.spawnDelay=520; this.items.push(it); }
          }
          // Mensagem final específica
          if(typeof window!=='undefined' && window.game && window.game.showToast){
            window.game.showToast('você derrotou o criador da escuridão os erros pararam você pode continuar a fazer seu codigo', 5200);
          }
          // Portal final após hacker
          this.placeExitPortal();
          this.exitPortal.active=true;
          this.exitPortal.x=CANVAS_W/2; this.exitPortal.y=CANVAS_H/2+44;
        }
      } else {
        if(hacker.dead && !this._hackerDeathFxDone){
          this._hackerDeathFxDone=true;
          for(let k=0;k<32;k++){ const ang=Math.random()*Math.PI*2; globalParticles.push(new Particle(hacker.x,hacker.y, Math.cos(ang)*randRange(2,6), Math.sin(ang)*randRange(2,6), 500, '#00ff88', 3)); }
          this.explosions.push({x:hacker.x, y:hacker.y, radius:18, life:520, max:520, isHackerDeath:true});
          if(typeof window!=='undefined' && window.game && window.game.showToast){
            window.game.showToast('HACKER: Sistema corrompido... falhando...', 1600);
          }
        }
        if(hacker.dead && hacker.victoryTimer>1300){
          const idx=this.enemies.indexOf(hacker);
          if(idx!==-1) this.enemies.splice(idx,1);
          this._hackerDeathFxDone=false;
        }
      }
    }

    // Festa Horda — vitória após limpar todas as ondas
    if(this.isPartyHorde && !this.partyHordeDefeated && this.partyWavesRemaining===0 && this.enemies.length===0){
      this.partyHordeDefeated = true;
      // Explosão de festa — confete + estrelas
      for(let k=0;k<42;k++){ const ang=Math.random()*Math.PI*2, sp=randRange(2.2,6.2); const col=PARTY_COLORS[randInt(0,PARTY_COLORS.length-1)]; globalParticles.push(new Particle(CANVAS_W/2, CANVAS_H/2, Math.cos(ang)*sp, Math.sin(ang)*sp, randRange(360,620), col, randInt(3,6))); }
      for(let k=0;k<20;k++) globalParticles.push(new Particle(CANVAS_W/2, CANVAS_H/2, randRange(-1.8,1.8), randRange(-1.8,0.6), 480, '#ffffff', 2.5));
      this.explosions.push({x:CANVAS_W/2, y:CANVAS_H/2, radius:22, life:600, max:600, isPartyHordeDeath:true});
      this.explosions.push({x:CANVAS_W/2-36, y:CANVAS_H/2+14, radius:14, life:420, max:420, isPartyHordeDeath:true});
      this.explosions.push({x:CANVAS_W/2+36, y:CANVAS_H/2+14, radius:14, life:420, max:420, isPartyHordeDeath:true});
      // Confetti extra
      for(let i=0;i<18;i++){
        const c=PARTY_COLORS[randInt(0,PARTY_COLORS.length-1)];
        globalParticles.push(new Particle(CANVAS_W/2+randRange(-40,40), CANVAS_H/2+randRange(-20,20), randRange(-1.2,1.2), randRange(-1.8,0.2), 520, c, 2));
      }
      const rewards=this.generatePartyRewards();
      for(const rw of rewards){
        let rx,ry,tries=0;
        do{
          rx=randRange(140, CANVAS_W-140); ry=randRange(120, CANVAS_H-120); tries++;
          let onWall=false; for(const w of this.walls) if(rectCollide(rx-12,ry-12,24,24,w.x,w.y,w.w,w.h)) onWall=true;
          if(!onWall && dist(rx,ry,CANVAS_W/2,CANVAS_H/2)>46) break;
        }while(tries<14);
        let it=null;
        if(rw.type==='weapon') it=new WeaponItem(rx,ry,rw.weaponType);
        else if(rw.type==='special') it=new SpecialItemPickup(rx,ry,rw.specialId);
        else if(rw.type==='upgrade') it=new UpgradeItem(rx,ry,rw.upgradeId);
        else it=new HealingItem(rx,ry,2);
        if(it){ it.spawnDelay=480; this.items.push(it); }
      }
    }

    // inimigo ↔ jogador - dano varia com variação (tanque/brutal/elite)
    for (const e of this.enemies) {
      if(e.type==='stair_boss') continue; // colisão cabeça/mãos já tratada no boss.update + powerStar
      if (rectCollide(player.x - player.w/2, player.y - player.h/2, player.w, player.h, e.x - e.w/2, e.y - e.h/2, e.w, e.h)) {
        if (e.canDamage() && !player.isInvulnerable()) {
          const dmg = e.collisionDamage || 1;
          if (player.takeDamage(dmg)) { e.resetDamageCooldown(); for(let k=0;k<8;k++) globalParticles.push(new Particle(player.x, player.y, randRange(-2.5,2.5), randRange(-3,1), 300, dmg>1?'#ff1a1a':'#ff3b30', 3)); }
        }
      }
    }

    // itens update
    for (let i=this.items.length-1;i>=0;i--) {
      const it=this.items[i];
      it.update(dt, player, globalParticles);
      if (it.collected) {
        let col = '#ff8c42';
        if(it.type.includes('heal')) col='#4ade80';
        else if(it.type==='flame_trail') col='#ff6a00';
        else if(it.type==='swift_boots') col='#00d9ff';
        else if(it.type==='raio') col='#00e5ff';
        else if(it.isUpgrade) col = it.rarity.color;
        else if(it.type==='double_shot') col='#5a8fd4';
        for(let k=0;k<12;k++){ const ang=Math.random()*Math.PI*2, sp=randRange(1.2,4); globalParticles.push(new Particle(it.x, it.y, Math.cos(ang)*sp, Math.sin(ang)*sp, randRange(260,420), col, randInt(2,4))); }
        // efeito extra para muito rara
        if(it.isUpgrade && it.rarity.id==='MUITO_RARA'){
          for(let k=0;k<8;k++) globalParticles.push(new Particle(it.x, it.y, randRange(-2,2), randRange(-2,-0.5), 380, it.rarity.gold||'#ffd700', 2));
        }
        this.items.splice(i,1);
      } else {
        it.anim += dt*0.001;
      }
    }

    // portal exit anim
    if (this.exitPortal) {
      this.exitPortal.anim += dt*0.004;
      // active já controlado externamente pelo Game (floor cleared)
    }
    }catch(e){ console.error('Room update error', e); }
  }

  draw(ctx, isCurrent) {
    try{
    const theme = this.theme || FLOOR_THEMES[this.floor] || FLOOR_THEMES[1];
    // Fix chão preto: garante fallback mesmo se theme incompleto (martelo/lança/machado não corrompem tema)
    const floorA = theme.floorA || '#141222';
    const floorB = theme.floorB || '#1a182e';
    // chão com tema da fase
    const tile = 48;
    for(let y=WALL_THICK; y<CANVAS_H - WALL_THICK; y+=tile){
      for(let x=WALL_THICK; x<CANVAS_W - WALL_THICK; x+=tile){
        const isDark = ((Math.floor(x/tile)+Math.floor(y/tile))%2===0);
        ctx.fillStyle = isDark ? floorA : floorB;
        ctx.fillRect(x, y, tile, tile);
        // decoração extra para caverna (pedras)
        if (theme.id===2 && Math.random()<0.0) {} // não aleatório por frame, usar padrão
        // padrão fixo de pedras para fase 2 usando posição
        if (theme.id===2) {
          const hash = (x*374761 + y*668265) % 100;
          if (hash < 7) {
            ctx.fillStyle='rgba(0,0,0,0.18)';
            ctx.fillRect(x+12, y+16, 8, 6);
            ctx.fillRect(x+28, y+32, 6, 4);
          }
        }
      }
    }
    // centro start
    if (this.isStart) {
      ctx.fillStyle = theme.id===2 ? 'rgba(255,140,66,0.08)' : 'rgba(255,204,0,0.07)';
      ctx.fillRect(CANVAS_W/2 - 60, CANVAS_H/2 - 60, 120, 120);
      ctx.strokeStyle = theme.id===2 ? 'rgba(255,140,66,0.22)' : 'rgba(255,204,0,0.18)';
      ctx.lineWidth = 2;
      ctx.strokeRect(CANVAS_W/2 - 60, CANVAS_H/2 - 60, 120, 120);
    }
    // paredes com tema
    for (const w of this.walls) {
      ctx.fillStyle = theme.wall;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = theme.wallTop;
      ctx.fillRect(w.x, w.y, w.w, 4);
      ctx.fillStyle = theme.wallLine;
      for(let yy=w.y+8; yy<w.y+w.h; yy+=12) ctx.fillRect(w.x, yy, w.w, 1);
      // detalhe extra caverna: rachaduras
      if(theme.id===2){
        ctx.fillStyle='rgba(0,0,0,0.14)';
        ctx.fillRect(w.x+6, w.y+6, 2, w.h-12);
      }
    }
    // portas
    const doorRects = this.getDoorRects();
    const locked = !this.isCleared();
    for (const d of doorRects) {
      const cx=CANVAS_W/2, cy=CANVAS_H/2;
      ctx.fillStyle = locked ? theme.doorLocked : '#1a3a1a';
      if (d.dir==='top') ctx.fillRect(cx - DOOR_W/2, 0, DOOR_W, WALL_THICK);
      if (d.dir==='bottom') ctx.fillRect(cx - DOOR_W/2, CANVAS_H - WALL_THICK, DOOR_W, WALL_THICK);
      if (d.dir==='left') ctx.fillRect(0, cy - DOOR_H/2, WALL_THICK, DOOR_H);
      if (d.dir==='right') ctx.fillRect(CANVAS_W - WALL_THICK, cy - DOOR_H/2, WALL_THICK, DOOR_H);
      if (locked) {
        ctx.fillStyle = theme.id===2 ? '#7a2a10' : '#7a1a10';
        if (d.dir==='top' || d.dir==='bottom') {
          const y = d.dir==='top' ? 4 : CANVAS_H - WALL_THICK + 4;
          ctx.fillRect(cx - DOOR_W/2 + 6, y, DOOR_W -12, WALL_THICK -8);
          ctx.fillStyle = '#3a0a00'; ctx.fillRect(cx -2, y, 4, WALL_THICK -8);
          ctx.fillStyle = '#ffcc00'; ctx.fillRect(cx -8, y+6, 16, 10);
          ctx.fillStyle = '#1a0000'; ctx.fillRect(cx -3, y+9, 6, 4);
        } else {
          const x = d.dir==='left' ? 4 : CANVAS_W - WALL_THICK +4;
          ctx.fillRect(x, cy - DOOR_H/2 +6, WALL_THICK -8, DOOR_H -12);
          ctx.fillStyle = '#3a0a00'; ctx.fillRect(x, cy -2, WALL_THICK -8, 4);
          ctx.fillStyle = '#ffcc00'; ctx.fillRect(x+4, cy -8, 10, 16);
        }
        ctx.fillStyle = 'rgba(255,59,48,0.22)';
        if (d.dir==='top') ctx.fillRect(cx -30, WALL_THICK, 60, 8);
        if (d.dir==='bottom') ctx.fillRect(cx -30, CANVAS_H - WALL_THICK -8, 60, 8);
        if (d.dir==='left') ctx.fillRect(WALL_THICK, cy -20, 8, 40);
        if (d.dir==='right') ctx.fillRect(CANVAS_W - WALL_THICK -8, cy -20, 8, 40);
      } else {
        ctx.fillStyle = '#0a0a14';
        if (d.dir==='top') ctx.fillRect(cx - DOOR_W/2 +10, 0, DOOR_W -20, WALL_THICK);
        if (d.dir==='bottom') ctx.fillRect(cx - DOOR_W/2 +10, CANVAS_H - WALL_THICK, DOOR_W -20, WALL_THICK);
        if (d.dir==='left') ctx.fillRect(0, cy - DOOR_H/2 +10, WALL_THICK, DOOR_H -20);
        if (d.dir==='right') ctx.fillRect(CANVAS_W - WALL_THICK, cy - DOOR_H/2 +10, WALL_THICK, DOOR_H -20);
        ctx.fillStyle = 'rgba(74,222,128,0.9)';
        ctx.font = '12px monospace'; ctx.textAlign='center';
        if (d.dir==='top') ctx.fillText('▲', cx, 16);
        if (d.dir==='bottom') ctx.fillText('▼', cx, CANVAS_H -6);
        if (d.dir==='left') ctx.fillText('◀', 12, cy+4);
        if (d.dir==='right') ctx.fillText('▶', CANVAS_W -8, cy+4);
        ctx.textAlign='left';
      }
    }

    // decoração sala rara (fundo distinto dourado/roxo)
    if(this.isRare){
      ctx.fillStyle='rgba(138,92,255,0.08)';
      ctx.fillRect(WALL_THICK, WALL_THICK, CANVAS_W-WALL_THICK*2, CANVAS_H-WALL_THICK*2);
      // partículas flutuantes douradas
      const t = Date.now()*0.003;
      for(let i=0;i<6;i++){
        const px = CANVAS_W/2 + Math.cos(t + i*1.1)* (80 + i*12);
        const py = CANVAS_H/2 + Math.sin(t*0.7 + i*0.9)* (50 + i*8);
        ctx.fillStyle=`rgba(255,215,0,${0.35 + Math.sin(t*2+i)*0.2})`;
        ctx.fillRect(px, py, 2,2);
      }
      // borda brilhante pulsante
      ctx.strokeStyle='rgba(255,215,0,0.22)';
      ctx.lineWidth=2;
      ctx.strokeRect(WALL_THICK+2, WALL_THICK+2, CANVAS_W-WALL_THICK*4, CANVAS_H-WALL_THICK*4);
      // estrela central
      ctx.fillStyle='rgba(255,215,0,0.18)';
      ctx.beginPath(); ctx.arc(CANVAS_W/2, CANVAS_H/2, 44, 0, Math.PI*2); ctx.fill();
    }
    // decoração boss sala da escada (Fase 5) - arena imponente no topo
    if(this.isBossStair){
      const boss=this.enemies.find(e=> e.type==='stair_boss');
      const isLocked = !this.isCleared() && !this.bossStairDefeated;
      const isVictory = this.bossStairDefeated;
      // Fundo arena escada
      ctx.fillStyle = isVictory ? 'rgba(40,30,10,0.06)' : isLocked ? 'rgba(80,40,10,0.16)' : 'rgba(80,40,10,0.09)';
      ctx.fillRect(WALL_THICK, WALL_THICK, CANVAS_W-WALL_THICK*2, CANVAS_H-WALL_THICK*2);
      // Borda arena dourada pulsante
      ctx.strokeStyle = isVictory ? 'rgba(255,215,0,0.42)' : isLocked ? 'rgba(255,215,0,0.52)' : 'rgba(255,215,0,0.28)';
      ctx.lineWidth = isLocked ? 3 : 2;
      ctx.setLineDash(isLocked ? [12,6] : []);
      ctx.strokeRect(WALL_THICK+4, WALL_THICK+4, CANVAS_W-WALL_THICK*8, CANVAS_H-WALL_THICK*8);
      ctx.setLineDash([]);
      const t=Date.now()*0.004;
      ctx.fillStyle=`rgba(255,215,0,${0.14+Math.sin(t*1.8)*0.06})`;
      ctx.beginPath(); ctx.arc(CANVAS_W/2, BOSS5_ARENA_Y, 64+Math.sin(t*1.4)*4,0,Math.PI*2); ctx.fill();
      // Faixa superior escada (degraus decorativos no topo)
      for(let i=0;i<5;i++){
        const yy=WALL_THICK+10+i*6;
        const alpha= isLocked ? 0.22 : 0.14;
        ctx.fillStyle=`rgba(120,90,40,${alpha})`;
        ctx.fillRect(WALL_THICK+14, yy, CANVAS_W-WALL_THICK*28, 3);
        ctx.fillStyle=`rgba(255,215,0,${alpha*0.6})`;
        ctx.fillRect(WALL_THICK+14+i*2, yy, CANVAS_W-WALL_THICK*28 - i*4, 1);
      }
      ctx.fillStyle = isVictory ? 'rgba(255,215,0,0.98)' : isLocked ? 'rgba(255,255,255,0.96)' : 'rgba(255,215,0,0.92)';
      ctx.font='10px "Press Start 2P"'; ctx.textAlign='center';
      ctx.fillText(isVictory?'✓ VÍRUS DESTRUÍDOS!': isLocked ? '◉ BOSS ESCADA ◉' : '◉ ARENA ESCADA ◉', CANVAS_W/2, BOSS5_ARENA_Y-48); ctx.textAlign='left';
      if(isLocked && boss && !boss.dead){
        // Hint fase
        const hpPct= boss.hp/boss.maxHp;
        if(hpPct<=0.5 && boss.headInvulnerable){
          ctx.fillStyle='rgba(255,215,0,0.92)'; ctx.font='7px "Press Start 2P"'; ctx.textAlign='center';
          ctx.fillText('DESTRUA AS MÃOS!', CANVAS_W/2, CANVAS_H-20); ctx.textAlign='left';
          ctx.fillStyle='rgba(255,215,0,0.22)';
          for(let i=0;i<2;i++){ const hx=boss.getHands()[i].x, hy=boss.getHands()[i].y; if(!boss.getHands()[i].dead){ ctx.beginPath(); ctx.arc(hx, hy, 12+Math.sin(t*3+i)*3,0,Math.PI*2); ctx.strokeStyle='rgba(255,215,0,0.55)'; ctx.lineWidth=1.5; ctx.stroke(); } }
        } else if(hpPct>0.5){
          ctx.fillStyle='rgba(255,255,255,0.72)'; ctx.font='6px monospace'; ctx.textAlign='center';
          ctx.fillText('Apenas a CABEÇA recebe dano', CANVAS_W/2, CANVAS_H-20); ctx.textAlign='left';
        }
        ctx.fillStyle='rgba(255,60,60,0.72)'; ctx.font='6px monospace'; ctx.textAlign='center';
        // piscando
        if(Math.floor(Date.now()/500)%2===0) ctx.fillText('ARENA FECHADA', CANVAS_W/2, CANVAS_H-32); ctx.textAlign='left';
        // partículas douradas flutuantes
        for(let i=0;i<3;i++){ const ang=t*0.7 + i*2.1; const px=CANVAS_W/2+Math.cos(ang)*80, py=BOSS5_ARENA_Y+Math.sin(ang*0.8)*18+10; ctx.fillStyle=`rgba(255,215,0,${0.35+Math.sin(t*2+i)*0.18})`; ctx.fillRect(px,py,2,2); }
      }
      if(isVictory){
        ctx.fillStyle='rgba(255,215,0,0.98)'; ctx.font='8px "Press Start 2P"'; ctx.textAlign='center';
        ctx.fillText('★ A ESCURIDÃO SE FOI ★', CANVAS_W/2, CANVAS_H/2+2); ctx.textAlign='left';
        ctx.fillStyle='#ffd700'; ctx.font='6px "Press Start 2P"'; ctx.textAlign='center';
        ctx.fillText('Os vírus foram destruídos...', CANVAS_W/2, CANVAS_H/2+16); ctx.textAlign='left';
        ctx.fillStyle='rgba(255,255,255,0.92)'; ctx.font='6px "Press Start 2P"'; ctx.textAlign='center';
        ctx.fillText('Você finalmente pode descansar.', CANVAS_W/2, CANVAS_H/2+28); ctx.textAlign='left';
        // Confete
        const t2=Date.now()*0.005;
        for(let i=0;i<8;i++){ const px=CANVAS_W/2+Math.cos(t2+i)* (40+i*8), py=CANVAS_H/2+8+Math.sin(t2*1.2+i)*12; ctx.fillStyle=['#ffd700','#fff','#ff8c42'][i%3]; ctx.fillRect(px,py,3,3); }
      }
      // Escada Corrompida - portal para Hacker (bloqueada antes, desbloqueia após Boss Escada)
      if(this.corruptedStair){
        const cs=this.corruptedStair;
        const t=Date.now()*0.004;
        const isActive=cs.active;
        // sombra
        ctx.fillStyle='rgba(0,0,0,0.32)'; ctx.beginPath(); ctx.ellipse(cs.x, cs.y+cs.h/2+6, cs.w/2+4, 7,0,0,Math.PI*2); ctx.fill();
        // base corrompida glitch
        const pulse=0.5+Math.sin(t*3)*0.28;
        ctx.fillStyle=isActive?`rgba(0,255,136,${0.18+pulse*0.12})`:`rgba(80,80,80,${0.14})`;
        ctx.fillRect(cs.x-cs.w/2-4, cs.y-cs.h/2-4, cs.w+8, cs.h+8);
        // escada normal bloqueada vs corrompida
        if(!isActive){
          ctx.fillStyle='rgba(120,90,40,0.22)'; ctx.fillRect(cs.x-cs.w/2, cs.y-cs.h/2, cs.w, cs.h);
          ctx.strokeStyle='rgba(255,0,64,0.45)'; ctx.lineWidth=2; ctx.setLineDash([6,4]);
          ctx.strokeRect(cs.x-cs.w/2, cs.y-cs.h/2, cs.w, cs.h); ctx.setLineDash([]);
          ctx.fillStyle='rgba(255,0,64,0.92)'; ctx.font='18px monospace'; ctx.textAlign='center';
          ctx.fillText('🔒', cs.x, cs.y+6); ctx.textAlign='left';
          ctx.fillStyle='rgba(255,255,255,0.62)'; ctx.font='5px "Press Start 2P"'; ctx.textAlign='center';
          ctx.fillText('BLOQUEADA', cs.x, cs.y+cs.h/2+14); ctx.textAlign='left';
        } else {
          // escada corrompida ativa - glitch verde/vermelho
          ctx.fillStyle='#0a1a12'; ctx.fillRect(cs.x-cs.w/2, cs.y-cs.h/2, cs.w, cs.h);
          // degraus corrompidos
          for(let i=0;i<4;i++){
            const yy=cs.y-cs.h/2+4+i*8;
            const glitchOff= (Math.floor(t*10+i)%2===0)? 1 : -1;
            ctx.fillStyle=i%2===0?`rgba(0,255,136,${0.85})`:`rgba(255,0,64,${0.85})`;
            ctx.fillRect(cs.x-cs.w/2+6+glitchOff, yy, cs.w-12, 3);
            ctx.fillStyle='rgba(255,255,255,0.92)'; ctx.fillRect(cs.x-cs.w/2+8, yy, cs.w-16, 1);
          }
          // borda pulsante corrompida
          ctx.strokeStyle=`rgba(0,255,136,${0.45+pulse*0.35})`; ctx.lineWidth=2;
          ctx.strokeRect(cs.x-cs.w/2, cs.y-cs.h/2, cs.w, cs.h);
          ctx.strokeStyle=`rgba(255,0,64,${0.28+pulse*0.18})`; ctx.lineWidth=1.2; ctx.setLineDash([4,3]);
          ctx.strokeRect(cs.x-cs.w/2-2, cs.y-cs.h/2-2, cs.w+4, cs.h+4); ctx.setLineDash([]);
          // código caindo
          ctx.fillStyle='rgba(0,255,136,0.72)'; ctx.font='6px monospace'; ctx.textAlign='center';
          const codeChars=['0','1','█','▓'];
          for(let i=0;i<3;i++){
            const cx=cs.x-12+i*12, cy=cs.y-cs.h/2-8 + (Math.sin(t*2+i)*3);
            ctx.fillText(codeChars[(i+Math.floor(t*2))%codeChars.length], cx, cy);
          }
          ctx.fillStyle='#00ff88'; ctx.font='6px "Press Start 2P"'; ctx.textAlign='center';
          ctx.fillText('ESCADA CORROMPIDA', cs.x, cs.y-cs.h/2-12); ctx.textAlign='left';
          ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.font='5px monospace'; ctx.textAlign='center';
          if(Math.floor(Date.now()/600)%2===0) ctx.fillText('▶ ENTRE [COLIDA]', cs.x, cs.y+cs.h/2+14);
          else ctx.fillText('DARK VÍRUS', cs.x, cs.y+cs.h/2+14);
          ctx.textAlign='left';
          // partículas glitch ao redor
          for(let i=0;i<2;i++){
            const ang=t*1.5+i*2.1, px=cs.x+Math.cos(ang)*(cs.w/2+6), py=cs.y+Math.sin(ang)*(cs.h/2+6);
            ctx.fillStyle=`rgba(${i===0?'0,255,136':'255,0,64'},${0.45+pulse*0.25})`; ctx.fillRect(px, py, 2,2);
          }
        }
      }
    }
    // Sala do Hacker - Dark Vírus (glitches, códigos, efeito corrompido)
    if(this.isHacker){
      const isLocked=this.hackerLocked;
      const isVictory=this.hackerDefeated;
      const t=Date.now()*0.004;
      // fundo corrompido com scanlines e glitch
      ctx.fillStyle=isVictory?'rgba(0,40,20,0.06)': isLocked?'rgba(10,10,14,0.16)':'rgba(8,12,20,0.18)';
      ctx.fillRect(WALL_THICK, WALL_THICK, CANVAS_W-WALL_THICK*2, CANVAS_H-WALL_THICK*2);
      // grid glitch
      ctx.strokeStyle='rgba(0,255,136,0.06)'; ctx.lineWidth=0.5;
      for(let x=WALL_THICK;x<CANVAS_W-WALL_THICK;x+=28){ ctx.beginPath(); ctx.moveTo(x, WALL_THICK); ctx.lineTo(x, CANVAS_H-WALL_THICK); ctx.stroke(); }
      for(let y=WALL_THICK;y<CANVAS_H-WALL_THICK;y+=28){ ctx.beginPath(); ctx.moveTo(WALL_THICK, y); ctx.lineTo(CANVAS_W-WALL_THICK, y); ctx.stroke(); }
      // scanline horizontal glitch
      if(!isLocked && !isVictory){
        const scanY= (Math.floor(t*120)% (CANVAS_H-WALL_THICK*2)) + WALL_THICK;
        ctx.fillStyle='rgba(0,255,136,0.08)'; ctx.fillRect(WALL_THICK, scanY, CANVAS_W-WALL_THICK*2, 2);
        if(Math.random()<0.08){
          const gx=randRange(WALL_THICK+12, CANVAS_W-WALL_THICK-12), gy=randRange(WALL_THICK+12, CANVAS_H-WALL_THICK-12);
          ctx.fillStyle='rgba(255,0,64,0.14)'; ctx.fillRect(gx, gy, randRange(12,36), randRange(2,6));
        }
      }
      // borda corrompida
      ctx.strokeStyle=isVictory?'rgba(0,255,136,0.42)': isLocked?'rgba(80,80,80,0.42)':'rgba(0,255,136,0.52)';
      ctx.lineWidth=isLocked?2.5:2;
      ctx.setLineDash(isLocked?[10,6]:[8,4]);
      ctx.strokeRect(WALL_THICK+4, WALL_THICK+4, CANVAS_W-WALL_THICK*8, CANVAS_H-WALL_THICK*8);
      ctx.setLineDash([]);
      // código binário caindo no fundo
      if(!isLocked){
        ctx.fillStyle='rgba(0,255,136,0.14)'; ctx.font='7px monospace';
        for(let i=0;i<12;i++){
          const cx=WALL_THICK+18+i*78, cy=WALL_THICK+20 + ((Math.floor(t*40+i*7)% (CANVAS_H-WALL_THICK*40)));
          ctx.fillText(Math.random()<0.5?'0':'1', cx, cy);
        }
        ctx.fillStyle='rgba(255,0,64,0.12)'; ctx.font='6px monospace';
        for(let i=0;i<8;i++){
          const cx=WALL_THICK+42+i*92, cy=WALL_THICK+30 + ((Math.floor(t*28+i*5)% (CANVAS_H-WALL_THICK*50)));
          ctx.fillText(['ERROR','NULL','0xDEAD','CORRUPT'][i%4], cx, cy);
        }
      }
      const hacker=this.enemies.find(e=>e.type==='hacker');
      ctx.fillStyle=isVictory?'rgba(0,255,136,0.98)': isLocked?'rgba(180,180,190,0.92)':'rgba(0,255,136,0.92)';
      ctx.font='10px "Press Start 2P"'; ctx.textAlign='center';
      ctx.fillText(isVictory?'✓ HACKER NEUTRALIZADO': isLocked?'◉ SALA CORROMPIDA BLOQUEADA':'◉ HACKER — DARK VÍRUS ◉', CANVAS_W/2, 38); ctx.textAlign='left';
      if(isLocked){
        ctx.fillStyle='rgba(255,0,64,0.85)'; ctx.font='7px "Press Start 2P"'; ctx.textAlign='center';
        ctx.fillText('Derrote o Boss da Escada para desbloquear', CANVAS_W/2, CANVAS_H/2-10); ctx.textAlign='left';
        ctx.fillStyle='rgba(0,255,136,0.42)'; ctx.font='5px monospace'; ctx.textAlign='center';
        ctx.fillText('ESCADA CORROMPIDA ↕', CANVAS_W/2, CANVAS_H/2+10); ctx.textAlign='left';
      } else if(!isVictory && hacker){
        const pct=hacker.hp/hacker.maxHp;
        ctx.fillStyle='rgba(255,255,255,0.72)'; ctx.font='6px monospace'; ctx.textAlign='center';
        if(pct>0.75) ctx.fillText('Fase 1: Tiros + Dash', CANVAS_W/2, CANVAS_H-22);
        else if(pct>0.5) ctx.fillText('Fase 2: Bazuca (2 dano) + Invocação', CANVAS_W/2, CANVAS_H-22);
        else if(pct>0.10) ctx.fillText('Fase 3: Invocação + Cura + CARRO 2.5♥', CANVAS_W/2, CANVAS_H-22);
        else ctx.fillText('Fase 4: SÓ SOCOS!', CANVAS_W/2, CANVAS_H-22);
        ctx.textAlign='left';
        if(Math.floor(Date.now()/500)%2===0){
          ctx.fillStyle='rgba(0,255,136,0.72)'; ctx.font='6px monospace'; ctx.textAlign='center';
          ctx.fillText('DARK VÍRUS ATIVO', CANVAS_W/2, CANVAS_H-32); ctx.textAlign='left';
        }
      }
      if(isVictory){
        ctx.fillStyle='rgba(0,255,136,0.98)'; ctx.font='7px "Press Start 2P"'; ctx.textAlign='center';
        ctx.fillText('você derrotou o criador da escuridão', CANVAS_W/2, CANVAS_H/2+2); ctx.textAlign='left';
        ctx.fillStyle='rgba(255,255,255,0.92)'; ctx.font='6px monospace'; ctx.textAlign='center';
        ctx.fillText('os erros pararam você pode continuar a fazer seu codigo', CANVAS_W/2, CANVAS_H/2+16); ctx.textAlign='left';
        const t2=Date.now()*0.005;
        for(let i=0;i<10;i++){ const px=CANVAS_W/2+Math.cos(t2+i*0.9)*(46+i*6), py=CANVAS_H/2+6+Math.sin(t2*1.2+i)*14; ctx.fillStyle=['#00ff88','#00e5ff','#ffffff'][i%3]; ctx.fillRect(px,py,3,3); }
      }
    }
    // decoração sala de festa — horda (qualquer fase) — tema vibrante
    if(this.isPartyHorde){
      const isLocked = !this.isCleared();
      const waveInfo = this.partyWave;
      const remaining = this.partyWavesRemaining;
      const totalWaves = PARTY_HORDE_WAVES;
      const done = this.partyHordeDefeated;
      // Fundo festa — gradiente quente + luzes
      ctx.fillStyle = done ? 'rgba(255,60,120,0.06)' : 'rgba(255,100,50,0.09)';
      ctx.fillRect(WALL_THICK, WALL_THICK, CANVAS_W-WALL_THICK*2, CANVAS_H-WALL_THICK*2);
      // Borda arco-íris pulsante
      const t=Date.now()*0.004;
      const hue = (t*18)%360;
      ctx.strokeStyle = done ? 'rgba(74,222,128,0.42)' : `hsla(${hue}, 92%, 62%, 0.52)`;
      ctx.lineWidth = isLocked ? 3 : 2.2;
      ctx.setLineDash(isLocked ? [10,6] : []);
      ctx.strokeRect(WALL_THICK+4, WALL_THICK+4, CANVAS_W-WALL_THICK*8, CANVAS_H-WALL_THICK*8);
      ctx.setLineDash([]);
      // Banner FESTA!
      const bannerY = WALL_THICK+14;
      ctx.fillStyle='rgba(0,0,0,0.22)'; ctx.fillRect(CANVAS_W/2-72, bannerY-8, 144, 20);
      // faixas coloridas
      for(let i=0;i<7;i++){
        ctx.fillStyle=PARTY_COLORS[i%PARTY_COLORS.length];
        const bx = CANVAS_W/2-64 + i*18;
        ctx.fillRect(bx, bannerY-6, 16, 14);
        ctx.fillStyle='rgba(0,0,0,0.18)'; ctx.fillRect(bx, bannerY+8, 16, 2);
      }
      ctx.fillStyle='#fff'; ctx.font='8px "Press Start 2P"'; ctx.textAlign='center';
      ctx.fillText(done?'♪ FESTA! ♪':'★ FESTA ★', CANVAS_W/2, bannerY+2); ctx.textAlign='left';
      // Balões nos cantos
      const balloons=[
        {x:WALL_THICK+18,y:WALL_THICK+28,c:PARTY_COLORS[0]}, {x:WALL_THICK+36,y:WALL_THICK+46,c:PARTY_COLORS[2]},
        {x:CANVAS_W-WALL_THICK-18,y:WALL_THICK+28,c:PARTY_COLORS[1]}, {x:CANVAS_W-WALL_THICK-36,y:WALL_THICK+46,c:PARTY_COLORS[4]},
        {x:WALL_THICK+22,y:CANVAS_H-WALL_THICK-22,c:PARTY_COLORS[5]}, {x:CANVAS_W-WALL_THICK-22,y:CANVAS_H-WALL_THICK-22,c:PARTY_COLORS[3]},
      ];
      for(let i=0;i<balloons.length;i++){
        const b=balloons[i];
        const bob=Math.sin(t*1.2 + i)*3;
        ctx.fillStyle=b.c;
        ctx.beginPath(); ctx.ellipse(b.x, b.y+bob, 10, 13, 0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.72)'; ctx.beginPath(); ctx.ellipse(b.x-3, b.y-3+bob, 3, 2.5, -0.4,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,0.45)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(b.x,b.y+13+bob); ctx.lineTo(b.x, b.y+20+bob); ctx.stroke();
        ctx.fillStyle=b.c; ctx.globalAlpha=0.22; ctx.beginPath(); ctx.arc(b.x,b.y+bob, 16,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
      }
      // Confetti flutuante
      for(const cf of this.partyConfetti){
        ctx.fillStyle=cf.c;
        ctx.save(); ctx.translate(cf.x, cf.y); ctx.rotate(cf.a);
        ctx.fillRect(-cf.s/2, -cf.s/2, cf.s, cf.s*0.6);
        ctx.restore();
        // brilho
        if(Math.random()<0.02){
          ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.fillRect(cf.x, cf.y,1,1);
        }
      }
      // Luzes de festa no topo
      for(let i=0;i<9;i++){
        const lx=WALL_THICK+28 + i*((CANVAS_W-WALL_THICK*56)/8);
        const col=PARTY_COLORS[i%PARTY_COLORS.length];
        const blink = 0.5 + Math.sin(t*2 + i*0.7)*0.5;
        ctx.fillStyle=col; ctx.globalAlpha=0.18+blink*0.22;
        ctx.beginPath(); ctx.arc(lx, WALL_THICK+6, 5+blink*2,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
        ctx.fillStyle=col; ctx.fillRect(lx-1, WALL_THICK+2,2,4);
      }
      // Info de ondas
      ctx.fillStyle = done ? 'rgba(74,222,128,0.96)' : isLocked ? 'rgba(255,255,255,0.96)' : 'rgba(255,215,0,0.92)';
      ctx.font='8px "Press Start 2P"'; ctx.textAlign='center';
      if(done){
        ctx.fillText('♪ HORDA FESTIVA VENCIDA! ♪', CANVAS_W/2, CANVAS_H/2-44);
        ctx.fillStyle='rgba(255,255,255,0.82)'; ctx.font='6px "Press Start 2P"';
        ctx.fillText('Recompensas liberadas!', CANVAS_W/2, CANVAS_H/2-28);
        // confete extra vitória
        const t2=Date.now()*0.005;
        for(let i=0;i<10;i++){ const px=CANVAS_W/2+Math.cos(t2+i*0.9)*(46+i*6), py=CANVAS_H/2+6+Math.sin(t2*1.2+i)*14; ctx.fillStyle=PARTY_COLORS[i%PARTY_COLORS.length]; ctx.fillRect(px,py,3,3); }
      } else {
        const waveTxt = `ONDA ${waveInfo}/${totalWaves}`;
        const eneTxt = `${this.enemies.length} inimigos`;
        ctx.fillText(`★ SALA DE FESTA ★  ${waveTxt}`, CANVAS_W/2, CANVAS_H/2-48);
        ctx.fillStyle='rgba(255,255,255,0.72)'; ctx.font='6px monospace'; ctx.textAlign='center';
        ctx.fillText(eneTxt + (remaining>0 ? ` • Próxima em ${Math.ceil(this.partyWaveTimer/1000)}s` : ''), CANVAS_W/2, CANVAS_H/2-36);
        if(this._partyNextWaveFlash>0){
          ctx.fillStyle=`rgba(255,215,0,${0.85 + Math.sin(t*6)*0.15})`; ctx.font='7px "Press Start 2P"';
          ctx.fillText('PRÓXIMA ONDA!', CANVAS_W/2, CANVAS_H-22);
        } else if(isLocked){
          ctx.fillStyle='rgba(255,80,120,0.82)'; ctx.font='6px monospace';
          if(Math.floor(Date.now()/500)%2===0) ctx.fillText('ARENA FECHADA — derrote a horda!', CANVAS_W/2, CANVAS_H-22);
        }
      }
      ctx.textAlign='left';
    }
    // decoração sala miniboss (Fase 4) - arena fechada distinta
    if(this.isMiniboss){
      const isLocked = !this.isCleared();
      ctx.fillStyle= isLocked ? 'rgba(80,20,120,0.13)' : 'rgba(80,20,120,0.06)';
      ctx.fillRect(WALL_THICK, WALL_THICK, CANVAS_W-WALL_THICK*2, CANVAS_H-WALL_THICK*2);
      // borda arena pulsante
      ctx.strokeStyle= isLocked ? 'rgba(217,70,239,0.48)' : 'rgba(217,70,239,0.24)';
      ctx.lineWidth= isLocked ? 3 : 2;
      ctx.setLineDash(isLocked ? [10,6] : []);
      ctx.strokeRect(WALL_THICK+4, WALL_THICK+4, CANVAS_W-WALL_THICK*8, CANVAS_H-WALL_THICK*8);
      ctx.setLineDash([]);
      const t=Date.now()*0.004;
      ctx.fillStyle=`rgba(217,70,239,${0.16+Math.sin(t*2)*0.07})`;
      ctx.beginPath(); ctx.arc(CANVAS_W/2, CANVAS_H/2, 52+Math.sin(t*1.5)*3,0,Math.PI*2); ctx.fill();
      ctx.fillStyle= isLocked?'rgba(255,255,255,0.92)':'rgba(255,215,0,0.95)';
      ctx.font='10px "Press Start 2P"'; ctx.textAlign='center';
      ctx.fillText(isLocked?'◉ MINIBOSS ◉':'✓ LIBERADO', CANVAS_W/2, CANVAS_H/2-48); ctx.textAlign='left';
      if(isLocked){
        ctx.fillStyle='rgba(217,70,239,0.18)';
        for(let i=0;i<4;i++){ const ang=(i/4)*Math.PI*2 + t*0.6; const px=CANVAS_W/2+Math.cos(ang)*70, py=CANVAS_H/2+Math.sin(ang)*46; ctx.beginPath(); ctx.arc(px,py,3,0,Math.PI*2); ctx.fill(); }
        ctx.fillStyle='rgba(255,60,60,0.72)'; ctx.font='7px monospace'; ctx.textAlign='center';
        ctx.fillText('ARENA FECHADA', CANVAS_W/2, CANVAS_H-20); ctx.textAlign='left';
      }
    }

    // rastros de fogo (desenha no chão, sob itens)
    for(const f of this.fires) f.draw(ctx);

    // espinhos
    for(const s of this.spikes) s.draw(ctx);

    // explosões kamikaze / Espada / Flecha / Bazuca / Boss Escada
    for(const ex of this.explosions){
      const alpha = clamp(ex.life / ex.max, 0, 1);
      let targetR = explosionRadius;
      if(ex.isKamikazeVariation) targetR = ex.isKamikazeVariation==='elite' ? Math.round(explosionRadius*1.28) : ex.isKamikazeVariation==='brute' ? Math.round(explosionRadius*1.18) : explosionRadius;
      else if(ex.isFlameSword) targetR=120;
      else if(ex.isSlow) targetR=FLECHA_SLOW_RADIUS;
      else if(ex.isParalyze) targetR=FLECHA_STUN_RADIUS;
      else if(ex.isBazuca) targetR=ex.radiusTarget || WEAPON_BAZUCA.explosionRadius;
      else if(ex.isPartyHordeDeath) targetR=110;
      else if(ex.isShockwave) targetR= BOSS5_SHOCKWAVE_MAX;
      else if(ex.isMeteor) targetR= BOSS5_METEOR_RADIUS;
      else if(ex.isHammerShock) targetR=84;
      else if(ex.isShieldPush) targetR=145;
      else if(ex.isShieldBlock) targetR=36;
      else if(ex.isFarmarAura || ex.isFarmarAuraEnd) targetR=FARMAR_AURA_RADIUS;
      else if(ex.isBossStairDeath) targetR=96;
      else if(ex.isHackerDeath) targetR=96;
      else if(ex.isHackerGlitch) targetR=36;
      else if(ex.isMinibossDeath) targetR=80;
      const r = 14 + (1-alpha)* (targetR - 14);
      if(ex.isFlameSword){
        ctx.strokeStyle=`rgba(255,90,0,${alpha*0.60})`;
        ctx.lineWidth=3.5;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle=`rgba(255,140,0,${alpha*0.28})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(255,215,0,${alpha*0.42})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.60, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(255,255,255,${alpha*0.55})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.32, 0, Math.PI*2); ctx.fill();
        if(alpha>0.35){
          ctx.strokeStyle=`rgba(255,255,255,${alpha*0.5})`;
          ctx.lineWidth=1.2;
          ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.85, 0, Math.PI*2); ctx.stroke();
        }
      } else if(ex.isSlow){
        ctx.strokeStyle=`rgba(96,165,250,${alpha*0.55})`;
        ctx.lineWidth=3;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle=`rgba(96,165,250,${alpha*0.18})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(180,210,255,${alpha*0.32})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.55, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(255,255,255,${alpha*0.55})`;
        ctx.font='10px monospace'; ctx.textAlign='center';
        ctx.fillText('❄', ex.x, ex.y+3); ctx.textAlign='left';
      } else if(ex.isParalyze){
        ctx.strokeStyle=`rgba(255,215,0,${alpha*0.60})`;
        ctx.lineWidth=3.5;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle=`rgba(255,215,0,${alpha*0.20})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(255,255,255,${alpha*0.38})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.55, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(255,255,0,${alpha*0.85})`;
        ctx.font='12px monospace'; ctx.textAlign='center';
        ctx.fillText('★', ex.x, ex.y+4); ctx.textAlign='left';
      } else if(ex.isBazuca){
        // Bazuca: explosão vermelha forte, anel duplo, faísca branca
        ctx.strokeStyle=`rgba(255,30,30,${alpha*0.65})`;
        ctx.lineWidth=4;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle=`rgba(255,60,30,${alpha*0.28})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(255,120,40,${alpha*0.38})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.62, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(255,255,255,${alpha*0.70})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.30, 0, Math.PI*2); ctx.fill();
        if(alpha>0.4){
          ctx.strokeStyle=`rgba(255,255,255,${alpha*0.55})`;
          ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.85,0,Math.PI*2); ctx.stroke();
        }
        // onda secundária
        if(alpha>0.5){
          ctx.strokeStyle=`rgba(255,200,60,${alpha*0.35})`;
          ctx.lineWidth=1.2;
          ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.45,0,Math.PI*2); ctx.stroke();
        }
      } else if(ex.isBossStairDeath){
        ctx.strokeStyle=`rgba(255,215,0,${alpha*0.65})`;
        ctx.lineWidth=4;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle=`rgba(255,215,0,${alpha*0.26})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(255,255,255,${alpha*0.42})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.58, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(255,140,40,${alpha*0.28})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.32, 0, Math.PI*2); ctx.fill();
        if(alpha>0.5){
          ctx.strokeStyle=`rgba(255,255,255,${alpha*0.55})`;
          ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.82,0,Math.PI*2); ctx.stroke();
          ctx.fillStyle=`rgba(255,255,255,${alpha*0.85})`;
          ctx.font='10px monospace'; ctx.textAlign='center';
          ctx.fillText('⭐', ex.x, ex.y+3); ctx.textAlign='left';
        }
      } else if(ex.isHackerDeath){
        ctx.strokeStyle=`rgba(0,255,136,${alpha*0.68})`;
        ctx.lineWidth=4;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle=`rgba(0,255,136,${alpha*0.22})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(255,255,255,${alpha*0.44})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.56,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(0,229,255,${alpha*0.28})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.32,0,Math.PI*2); ctx.fill();
        if(alpha>0.5){
          ctx.strokeStyle=`rgba(255,255,255,${alpha*0.55})`;
          ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.82,0,Math.PI*2); ctx.stroke();
          ctx.fillStyle=`rgba(0,255,136,${alpha*0.92})`;
          ctx.font='8px monospace'; ctx.textAlign='center';
          ctx.fillText('HACK', ex.x, ex.y+3); ctx.textAlign='left';
        }
      } else if(ex.isHackerGlitch){
        ctx.strokeStyle=`rgba(0,255,136,${alpha*0.55})`;
        ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle=`rgba(0,255,136,${alpha*0.14})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(255,0,64,${alpha*0.38})`;
        ctx.fillRect(ex.x-4, ex.y-1, 8, 2);
        ctx.fillStyle=`rgba(255,255,255,${alpha*0.52})`;
        ctx.font='6px monospace'; ctx.textAlign='center';
        ctx.fillText(['0','1','█'][Math.floor(alpha*3)%3], ex.x, ex.y+2); ctx.textAlign='left';
      } else if(ex.isShieldPush){
        // Onda de repulsão do escudo
        ctx.strokeStyle=`rgba(0,229,255,${alpha*0.55})`;
        ctx.lineWidth=3.5;
        ctx.setLineDash([6,4]);
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle=`rgba(0,229,255,${alpha*0.10})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle=`rgba(255,255,255,${alpha*0.35})`;
        ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.72, 0, Math.PI*2); ctx.stroke();
          // setas de repulsão
        if(alpha>0.45){
          ctx.strokeStyle=`rgba(0,229,255,${alpha*0.55})`;
          ctx.lineWidth=1.2;
          for(let a=0;a<4;a++){
            const ang=(a/4)*Math.PI*2;
            const x1=ex.x + Math.cos(ang)*r*0.55, y1=ex.y + Math.sin(ang)*r*0.55;
            const x2=ex.x + Math.cos(ang)*r*0.85, y2=ex.y + Math.sin(ang)*r*0.85;
            ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
            // ponta seta
            ctx.beginPath(); ctx.arc(x2,y2,2,0,Math.PI*2); ctx.fillStyle=`rgba(0,229,255,${alpha})`; ctx.fill();
          }
        }
      } else if(ex.isFarmarAura || ex.isFarmarAuraEnd){
        // Farmar Aura 67 - anel rosa expansivo com 67 central (inicio e fim)
        const isEnd = !!ex.isFarmarAuraEnd;
        ctx.strokeStyle=`rgba(255,107,157,${alpha*(isEnd?0.48:0.62)})`;
        ctx.lineWidth=isEnd?3:4;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle=`rgba(255,107,157,${alpha*(isEnd?0.10:0.14)})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(255,209,220,${alpha*(isEnd?0.18:0.24)})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.55, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle=`rgba(255,255,255,${alpha*0.45})`;
        ctx.lineWidth=1.2;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.78, 0, Math.PI*2); ctx.stroke();
        // ícone 67 central pulsante
        ctx.fillStyle=`rgba(255,255,255,${alpha*0.95})`;
        ctx.font='bold 13px "Press Start 2P"'; ctx.textAlign='center';
        ctx.fillText('67', ex.x, ex.y+5); ctx.textAlign='left';
        if(alpha>0.45){
          ctx.strokeStyle=`rgba(255,107,157,${alpha*0.42})`;
          ctx.lineWidth=1.5; ctx.setLineDash([5,3]);
          ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.88, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
        }
        // anel secundário
        if(alpha>0.55){
          ctx.fillStyle=`rgba(255,107,157,${alpha*0.32})`;
          ctx.beginPath(); ctx.arc(ex.x, ex.y, 6, 0, Math.PI*2); ctx.fill();
        }
      } else if(ex.isPartyHordeDeath){
        ctx.strokeStyle=`rgba(255,60,120,${alpha*0.65})`;
        ctx.lineWidth=3.5;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle=`rgba(255,215,0,${alpha*0.16})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(255,255,255,${alpha*0.42})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.52, 0, Math.PI*2); ctx.fill();
        // confete no anel
        for(let i=0;i<6;i++){
          const ang=(i/6)*Math.PI*2 + Date.now()*0.004;
          const px=ex.x + Math.cos(ang)*r*0.72, py=ex.y + Math.sin(ang)*r*0.72;
          ctx.fillStyle=PARTY_COLORS[i%PARTY_COLORS.length];
          ctx.globalAlpha=alpha;
          ctx.fillRect(px-1.5, py-1.5, 3, 3);
          ctx.globalAlpha=1;
        }
        ctx.fillStyle=`rgba(255,255,255,${alpha*0.88})`;
        ctx.font='12px monospace'; ctx.textAlign='center';
        ctx.fillText('♪', ex.x, ex.y+4); ctx.textAlign='left';
      } else if(ex.isShieldBlock){
        ctx.strokeStyle=`rgba(0,229,255,${alpha*0.70})`;
        ctx.lineWidth=3;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle=`rgba(0,229,255,${alpha*0.18})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(255,255,255,${alpha*0.55})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.45, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle=`rgba(255,255,255,${alpha*0.45})`;
        ctx.lineWidth=1.2;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.75, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle=`rgba(0,229,255,${alpha*0.92})`;
        ctx.font='10px monospace'; ctx.textAlign='center';
        ctx.fillText('🛡️', ex.x, ex.y+3); ctx.textAlign='left';
      } else if(ex.isMinibossDeath){
        ctx.strokeStyle=`rgba(217,70,239,${alpha*0.62})`;
        ctx.lineWidth=3.5;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle=`rgba(217,70,239,${alpha*0.22})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(255,215,0,${alpha*0.30})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.55,0,Math.PI*2); ctx.fill();
      } else if(ex.isShockwave){
        // Shockwave da mão do boss - anel laranja/vermelho expansivo (exige dash/esquiva)
        const isDouble= ex.isDouble;
        ctx.strokeStyle= isDouble? `rgba(255,40,30,${alpha*0.68})` : `rgba(255,90,0,${alpha*0.62})`;
        ctx.lineWidth= isDouble?4.2:3.4;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle= isDouble? `rgba(255,60,30,${alpha*0.14})` : `rgba(255,140,0,${alpha*0.12})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.fill();
        // anel interno pulsante
        if(alpha>0.45){
          ctx.strokeStyle=`rgba(255,215,0,${alpha*0.42})`;
          ctx.lineWidth=1.2;
          ctx.setLineDash([4,3]);
          ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.72,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle=`rgba(255,255,255,${(alpha-0.45)*0.9})`;
          ctx.beginPath(); ctx.arc(ex.x, ex.y, 4,0,Math.PI*2); ctx.fill();
        }
      } else if(ex.isMeteor){
        ctx.strokeStyle=`rgba(255,60,30,${alpha*0.68})`;
        ctx.lineWidth=3.8;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle=`rgba(255,90,0,${alpha*0.18})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(255,215,0,${alpha*0.28})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.52,0,Math.PI*2); ctx.fill();
        if(alpha>0.5){
          ctx.fillStyle=`rgba(255,255,255,${(alpha-0.5)*1.1})`;
          ctx.beginPath(); ctx.arc(ex.x, ex.y, 6,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='rgba(255,60,30,0.95)'; ctx.font='8px monospace'; ctx.textAlign='center';
          ctx.fillText('💥', ex.x, ex.y+2); ctx.textAlign='left';
        }
      } else if(ex.isHammerShock){
        ctx.strokeStyle=`rgba(138,109,59,${alpha*0.66})`;
        ctx.lineWidth=3.6;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle=`rgba(138,109,59,${alpha*0.16})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(194,168,122,${alpha*0.28})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.55,0,Math.PI*2); ctx.fill();
        if(alpha>0.45){
          ctx.strokeStyle=`rgba(255,255,255,${alpha*0.42})`;
          ctx.lineWidth=1.2; ctx.setLineDash([4,3]);
          ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.72,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
        }
        // ícone martelo
        if(alpha>0.5){
          ctx.fillStyle=`rgba(138,109,59,${alpha*0.92})`; ctx.font='8px monospace'; ctx.textAlign='center';
          ctx.fillText('🔨', ex.x, ex.y+3); ctx.textAlign='left';
        }
      } else if(ex.isBoneBreak){
        // Bone Heart quebrou - explosão cinza/osso com fragmentos
        ctx.strokeStyle=`rgba(160,170,185,${alpha*0.65})`;
        ctx.lineWidth=3.2;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle=`rgba(160,180,200,${alpha*0.16})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(220,230,240,${alpha*0.38})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.55,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(255,255,255,${alpha*0.55})`;
        ctx.font='10px monospace'; ctx.textAlign='center';
        ctx.fillText('◆', ex.x, ex.y+3); ctx.textAlign='left';
        if(alpha>0.5){
          ctx.strokeStyle=`rgba(200,210,225,${alpha*0.45})`;
          ctx.lineWidth=1.2; ctx.setLineDash([4,3]);
          ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.75,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
        }
      } else if(ex.isBoneHit){
        // Hit em Bone Heart mas não quebrou (drenou)
        ctx.strokeStyle=`rgba(140,170,190,${alpha*0.55})`;
        ctx.lineWidth=2.2;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle=`rgba(160,190,210,${alpha*0.14})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(200,220,235,${alpha*0.28})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.5,0,Math.PI*2); ctx.fill();
      } else if(ex.isCyberHeart){
        // Coleta Bone Heart (mantém isCyberHeart para compatibilidade)
        ctx.strokeStyle=`rgba(0,229,255,${alpha*0.60})`;
        ctx.lineWidth=3;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle=`rgba(160,200,220,${alpha*0.18})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(255,255,255,${alpha*0.42})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.45,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(0,229,255,${alpha*0.85})`;
        ctx.font='9px monospace'; ctx.textAlign='center';
        ctx.fillText('◆', ex.x, ex.y+3); ctx.textAlign='left';
      } else if(ex.isMotosserraHeal){
        // Motosserra curou 1 coração - explosão verde cura
        ctx.strokeStyle=`rgba(74,222,128,${alpha*0.68})`;
        ctx.lineWidth=3.2;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle=`rgba(74,222,128,${alpha*0.18})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(255,255,255,${alpha*0.42})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.52,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(74,222,128,${alpha*0.92})`;
        ctx.font='10px monospace'; ctx.textAlign='center';
        ctx.fillText('♥', ex.x, ex.y+3); ctx.textAlign='left';
        if(alpha>0.5){
          ctx.strokeStyle=`rgba(255,255,255,${alpha*0.45})`;
          ctx.lineWidth=1.2; ctx.setLineDash([4,3]);
          ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.75,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
        }
      } else {
        // kamikaze padrão (variação brutal/elite = mais vermelho/intenso)
        const isBruteKamikaze = ex.isKamikazeVariation==='brute' || ex.isKamikazeVariation==='elite';
        const isEliteKamikaze = ex.isKamikazeVariation==='elite';
        ctx.strokeStyle=isBruteKamikaze?`rgba(255,30,30,${alpha*0.68})`:`rgba(255,80,0,${alpha*0.55})`;
        ctx.lineWidth=3;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle=`rgba(255,140,0,${alpha*0.22})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(255,215,0,${alpha*0.32})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r*0.55, 0, Math.PI*2); ctx.fill();
        if(alpha>0.45){
          ctx.fillStyle=`rgba(255,255,255,${(alpha-0.45)*1.2})`;
          ctx.beginPath(); ctx.arc(ex.x, ex.y, 8, 0, Math.PI*2); ctx.fill();
        }
      }
    }
    // auras JL Farmar Aura - premium neon com expansão + partículas digitais
    if(this.farmarAuras){
      for(const fa of this.farmarAuras){
        const alpha=clamp(fa.life/fa.maxLife,0,1);
        const r=fa.radius;
        // outer soft glow maior
        ctx.fillStyle=`rgba(255,107,157,${alpha*0.08})`;
        ctx.beginPath(); ctx.arc(fa.x, fa.y, r*1.14, 0, Math.PI*2); ctx.fill();
        // fill principal
        ctx.fillStyle=`rgba(255,107,157,${alpha*0.12})`;
        ctx.beginPath(); ctx.arc(fa.x, fa.y, r, 0, Math.PI*2); ctx.fill();
        // anel externo neon
        ctx.strokeStyle=`rgba(255,107,157,${alpha*0.62})`;
        ctx.lineWidth=3.8;
        ctx.beginPath(); ctx.arc(fa.x, fa.y, r, 0, Math.PI*2); ctx.stroke();
        // anel interno tracejado energizado
        ctx.strokeStyle=`rgba(255,182,193,${alpha*0.42})`;
        ctx.lineWidth=1.4; ctx.setLineDash([8,6]);
        ctx.beginPath(); ctx.arc(fa.x, fa.y, r*0.75,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
        // ticks externos 12 com brilho
        if(alpha>0.35){
          for(let a=0;a<12;a++){
            const ang=(a/12)*Math.PI*2 + fa.life*0.005;
            const x1=fa.x+Math.cos(ang)*r*0.96, y1=fa.y+Math.sin(ang)*r*0.96;
            const x2=fa.x+Math.cos(ang)*r*1.07, y2=fa.y+Math.sin(ang)*r*1.07;
            ctx.strokeStyle=`rgba(255,107,157,${alpha*0.55})`;
            ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
            ctx.fillStyle=`rgba(255,255,255,${alpha*0.78})`; ctx.beginPath(); ctx.arc(x2,y2,1.1,0,Math.PI*2); ctx.fill();
          }
        }
        if(alpha>0.45){
          ctx.strokeStyle=`rgba(255,255,255,${alpha*0.32})`;
          ctx.lineWidth=1.2;
          ctx.beginPath(); ctx.arc(fa.x, fa.y, r*0.78,0,Math.PI*2); ctx.stroke();
          // núcleo central brilho duplo
          ctx.fillStyle=`rgba(255,107,157,${alpha*0.32})`;
          ctx.beginPath(); ctx.arc(fa.x, fa.y, 9,0,Math.PI*2); ctx.fill();
          ctx.fillStyle=`rgba(255,255,255,${alpha*0.18})`;
          ctx.beginPath(); ctx.arc(fa.x, fa.y, 5,0,Math.PI*2); ctx.fill();
        }
        // setas de empurrão ao redor com cabeça premium
        if(alpha>0.5){
          for(let a=0;a<6;a++){
            const ang=(a/6)*Math.PI*2 + fa.life*0.004;
            const x1=fa.x+Math.cos(ang)*r*0.55, y1=fa.y+Math.sin(ang)*r*0.55;
            const x2=fa.x+Math.cos(ang)*r*0.88, y2=fa.y+Math.sin(ang)*r*0.88;
            ctx.strokeStyle=`rgba(255,107,157,${alpha*0.58})`;
            ctx.lineWidth=1.6; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
            ctx.fillStyle=`rgba(255,255,255,${alpha*0.96})`; ctx.beginPath(); ctx.arc(x2,y2,1.9,0,Math.PI*2); ctx.fill();
            ctx.fillStyle=`rgba(255,107,157,${alpha})`; ctx.beginPath(); ctx.arc(x2,y2,0.9,0,Math.PI*2); ctx.fill();
          }
        }
        // 67 central que desvanece com escala pulsante + sombra neon
        ctx.save();
        ctx.globalAlpha=alpha;
        ctx.shadowColor='#ff6b9d'; ctx.shadowBlur=14*alpha;
        ctx.fillStyle=`rgba(255,255,255,${0.96})`;
        ctx.font='bold 11px "Press Start 2P"'; ctx.textAlign='center';
        ctx.fillText('67', fa.x, fa.y+4);
        ctx.restore();
        ctx.textAlign='left';
        // partículas digitais 6/7 orbitais quando ainda forte
        if(alpha>0.6){
          for(let o=0;o<4;o++){
            const ang=(o/4)*Math.PI*2 + fa.life*0.006;
            const rx=fa.x+Math.cos(ang)*r*0.58, ry=fa.y+Math.sin(ang)*r*0.58;
            ctx.fillStyle=`rgba(255,255,255,${alpha*0.82})`; ctx.font='6px monospace'; ctx.textAlign='center';
            ctx.fillText(o%2?'7':'6', rx, ry+2); ctx.textAlign='left';
          }
        }
      }
    }

    // portal de saída (escada)
    if (this.exitPortal) {
      const p=this.exitPortal;
      const px=p.x, py=p.y -8;
      // sombra
      ctx.fillStyle='rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(px, py+18, 28, 10, 0,0,Math.PI*2); ctx.fill();
      // base escada
      const active = p.active;
      ctx.fillStyle= active ? '#1e1b2e' : '#2a2a2e';
      ctx.fillRect(px-24, py-2, 48, 22);
      // degraus
      for(let i=0;i<3;i++){
        ctx.fillStyle= active ? (i%2===0?'#4a3a6a':'#6b4a8a') : '#3a3a3a';
        ctx.fillRect(px-20 + i*4, py + i*4, 40 - i*8, 4);
      }
      // brilho quando ativo
      if(active){
        const pulse = 0.6 + Math.sin(p.anim*2)*0.35;
        ctx.fillStyle=`rgba(255,204,0,${0.22*pulse})`;
        ctx.fillRect(px-24, py-8, 48, 32);
        ctx.fillStyle=`rgba(255,255,255,${0.9})`;
        ctx.font='8px "Press Start 2P"'; ctx.textAlign='center';
        ctx.fillText('⬇', px, py-14);
        ctx.font='5px "Press Start 2P"';
        ctx.fillText(this.floor===1?'PRÓXIMA FASE':'SAÍDA', px, py-22);
        ctx.textAlign='left';
        // seta pulsante
        ctx.fillStyle=`rgba(255,204,0,${pulse})`;
        ctx.beginPath();
        const ay = py-10 + Math.sin(p.anim*3)*3;
        ctx.moveTo(px, ay); ctx.lineTo(px-7, ay-7); ctx.lineTo(px+7, ay-7); ctx.closePath(); ctx.fill();
      } else {
        // bloqueado com corrente
        ctx.fillStyle='#1a1a1a';
        ctx.fillRect(px-16, py-6, 32, 6);
        ctx.fillStyle='#ff3b30';
        ctx.font='7px monospace'; ctx.textAlign='center';
        ctx.fillText('🔒', px, py+4); ctx.textAlign='left';
        ctx.fillStyle='rgba(255,59,48,0.6)';
        ctx.font='5px "Press Start 2P"'; ctx.textAlign='center';
        ctx.fillText('LIMPE O ANDAR', px, py-18); ctx.textAlign='left';
      }
    }

    // itens no chão (desenha antes dos inimigos para ficar atrás? na verdade por cima do chão)
    for(const it of this.items) it.draw(ctx);

    // inimigos
    for (const e of this.enemies) e.draw(ctx);
    // Chapéu de festa para horda
    if(this.isPartyHorde){
      for(const e of this.enemies){
        if(e.isParty && !e.dead){
          const ex=e.x, ey=e.y - e.h/2 - 4;
          const colIdx = e.anim ? Math.floor(e.anim/320) % PARTY_COLORS.length : 0;
          ctx.fillStyle=PARTY_COLORS[colIdx];
          ctx.beginPath(); ctx.moveTo(ex, ey-10); ctx.lineTo(ex-6, ey-2); ctx.lineTo(ex+6, ey-2); ctx.closePath(); ctx.fill();
          ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(ex, ey-10, 2.2,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='rgba(255,255,255,0.92)'; ctx.fillRect(ex-6, ey-2, 12, 1.5);
          ctx.fillStyle='rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.arc(ex, ey-2, 5,0,Math.PI*2); ctx.fill();
        }
      }
    }

    if (this.type==='treasure' && this.visited && !this.isExit) {
      ctx.fillStyle = theme.id===2 ? 'rgba(255,140,66,0.08)' : 'rgba(255,204,0,0.10)';
      ctx.fillRect(WALL_THICK, WALL_THICK, CANVAS_W - WALL_THICK*2, CANVAS_H - WALL_THICK*2);
    }
    }catch(e){ console.error('Room draw error', e); try{ ctx.fillStyle='#141222'; ctx.fillRect(WALL_THICK, WALL_THICK, CANVAS_W-WALL_THICK*2, CANVAS_H-WALL_THICK*2); for(const en of (this.enemies||[])) try{en.draw(ctx);}catch(_){} }catch(_){} }
  }
}

// ===================== MAP GENERATOR =====================
class MapGenerator {
  constructor(seed, floor=1) {
    this.seed = seed ?? Math.floor(Math.random()*1e9);
    this.floor = floor;
    this.rng = mulberry32(this.seed);
  }
  generate() {
    const rng = this.rng;
    let targetRooms;
    if(this.floor===5) targetRooms = 11 + Math.floor(rng()*4); // 11-14 Fase 5 maior + boss escada
    else if(this.floor===4) targetRooms = 10 + Math.floor(rng()*4); // 10-13 Fase 4 maior + miniboss
    else if(this.floor===3) targetRooms = 9 + Math.floor(rng()*4); // 9-12 mais difícil
    else if(this.floor===2) targetRooms = 8 + Math.floor(rng()*4); // 8-11
    else targetRooms = 7 + Math.floor(rng()*3); // 7-9
    const gridW = 5, gridH = 5;
    const startX = 2, startY=2;
    const roomsMap = new Map();
    const key = (x,y)=>`${x},${y}`;
    const dirs = [{dx:0,dy:-1,dir:'top',opp:'bottom'},{dx:0,dy:1,dir:'bottom',opp:'top'},{dx:-1,dy:0,dir:'left',opp:'right'},{dx:1,dy:0,dir:'right',opp:'left'}];
    roomsMap.set(key(startX,startY), {x:startX,y:startY});
    const list = [{x:startX,y:startY}];
    while (roomsMap.size < targetRooms) {
      const base = list[Math.floor(rng()*list.length)];
      const shuffled=[...dirs].sort(()=>rng()-0.5);
      let placed=false;
      for(const d of shuffled){
        const nx=base.x+d.dx, ny=base.y+d.dy;
        if(nx<0||nx>=gridW||ny<0||ny>=gridH) continue;
        if(roomsMap.has(key(nx,ny))) continue;
        roomsMap.set(key(nx,ny), {x:nx,y:ny});
        list.push({x:nx,y:ny});
        placed=true; break;
      }
      if(!placed){ if(list.length>30) break; }
    }
    const rooms = [];
    const roomLookup = new Map();
    for(const pos of roomsMap.values()){
      const doors={top:false,bottom:false,left:false,right:false};
      for(const d of dirs){
        const nx=pos.x+d.dx, ny=pos.y+d.dy;
        if(roomsMap.has(key(nx,ny))) doors[d.dir]=true;
      }
      const isStart = pos.x===startX && pos.y===startY;
      const room = new Room(pos.x,pos.y,doors,isStart,rng,this.floor);
      rooms.push(room);
      roomLookup.set(key(pos.x,pos.y), room);
    }
    // escolhe sala de saída: a mais distante do start (dead end ideal)
    let exitRoom=null, maxD=-1;
    for(const r of rooms){
      if(r.isStart) continue;
      const d=Math.abs(r.gx-startX)+Math.abs(r.gy-startY);
      // prefere dead end (1 porta)
      const doorCount = Object.values(r.doors).filter(Boolean).length;
      const score = d*10 + (doorCount===1?5:0) + rng()*2;
      if(score>maxD){ maxD=score; exitRoom=r; }
    }
    if(exitRoom){
      exitRoom.placeExitPortal();
      // sala de saída sem inimigos iniciais? Mantém inimigos mas portal só ativa após limpar andar todo
      // já tem spawn, ok
    }

    // Fase 5: sala do boss da escada (obrigatória, na sala da escada = exitRoom)
    if(this.floor===5 && exitRoom){
      // Transforma a sala da escada em arena de boss (substitui exit normal)
      // Mantém exitRoom como boss arena, portal só libera após derrotar boss
      exitRoom.makeBossStairRoom(rng);
      // Remove portal antigo (será recriado após vitória)
      exitRoom.exitPortal = null;
      exitRoom.isExit = false; // vitória cuida do portal
    }
    // Sala rara especial: chance configurável rareRoomChance por andar (não start/exit)
    if(rng() < rareRoomChance){
      const candidates = rooms.filter(r=> !r.isStart && !r.isExit && !r.isRare && !r.isMiniboss && !r.isBossStair && !r.isPartyHorde);
      if(candidates.length){
        // escolhe uma sala aleatória não-start/exit, prefere que não seja já sobrecarregada
        const rc = candidates[Math.floor(rng()*candidates.length)];
        rc.makeRareRoom(rng);
      }
    }
    // Sala Miniboss: pode aparecer em QUALQUER fase exceto 5 (35% chance, configurável MINIBOSS_ROOM_CHANCE)
    // Fase 5 tem boss próprio, não gera miniboss
    if(this.floor!==5 && rng() < MINIBOSS_ROOM_CHANCE){
      const candidates = rooms.filter(r=> !r.isStart && !r.isExit && !r.isRare && !r.isMiniboss && !r.isBossStair && !r.isPartyHorde);
      if(candidates.length){
        // prefere sala com 1 porta (dead end) para arena mais isolada
        let pool=candidates;
        const deadEnds=candidates.filter(r=> Object.values(r.doors).filter(Boolean).length===1);
        if(deadEnds.length && rng()<0.7) pool=deadEnds;
        const rc = pool[Math.floor(rng()*pool.length)];
        rc.makeMinibossRoom(rng);
      }
    }
    // Sala de Festa (Horda) — pode aparecer em qualquer fase 1-5 (20%)
    if(rng() < PARTY_HORDE_CHANCE){
      const candidates = rooms.filter(r=> !r.isStart && !r.isExit && !r.isRare && !r.isMiniboss && !r.isBossStair && !r.isPartyHorde);
      if(candidates.length){
        let pool=candidates;
        const twoDoors=candidates.filter(r=> Object.values(r.doors).filter(Boolean).length===2);
        if(twoDoors.length && rng()<0.6) pool=twoDoors;
        const rc = pool[Math.floor(rng()*pool.length)];
        rc.makePartyHordeRoom(rng);
      }
    }

    // Garante um Shotgun por fase em sala aleatória não-start não-exit (se ainda não spawnou natural)
    // Fase 3 pode ter shotgun também, mas garante apenas se não houver shotgun nem rare/miniboss (já tem item)
    const hasShotgun = rooms.some(r=>r.items.some(it=>it.type==='shotgun'));
    if(!hasShotgun && !rooms.some(r=>r.isRare || r.isMiniboss || r.isBossStair || r.isPartyHorde)){
      const candidates = rooms.filter(r=>!r.isStart && !r.isExit && !r.isRare && !r.isMiniboss && !r.isBossStair && !r.isPartyHorde);
      if(candidates.length){
        const rc = candidates[Math.floor(rng()*candidates.length)];
        if(rc.items.length<2){
          let x,y,tries=0;
          do{
            x=randRange(150, CANVAS_W-150);
            y=randRange(110, CANVAS_H-110);
            tries++;
            let onWall=false;
            for(const w of rc.walls) if(rectCollide(x-11,y-11,22,22,w.x,w.y,w.w,w.h)) {onWall=true;break;}
            if(!onWall && dist(x,y,CANVAS_W/2,CANVAS_H/2)>70) break;
          }while(tries<16);
          const sg = new WeaponItem(x,y,'shotgun');
          sg.spawnDelay=360;
          rc.items.push(sg);
        }
      }
    }
    // Garante uma arma CARREGADA por andar (arma comum) se ainda não houver, reforçando característica comum
    const hasCarregada = rooms.some(r=>r.items.some(it=> it.type==='carregada' || it.weaponType==='carregada'));
    if(!hasCarregada){
      const candidates = rooms.filter(r=>!r.isStart && !r.isExit && !r.isRare && !r.isMiniboss && !r.isBossStair && !r.isPartyHorde);
      if(candidates.length){
        // tenta colocar em sala que ainda tem espaço, evita lotar
        const filtered = candidates.filter(r=> r.items.length < 2);
        const pool = filtered.length ? filtered : candidates;
        const rc = pool[Math.floor(rng()*pool.length)];
        let x,y,tries=0;
        do{
          x=randRange(150, CANVAS_W-150);
          y=randRange(110, CANVAS_H-110);
          tries++;
          let onWall=false;
          for(const w of rc.walls) if(rectCollide(x-11,y-11,22,22,w.x,w.y,w.w,w.h)) {onWall=true;break;}
          if(!onWall && dist(x,y,CANVAS_W/2,CANVAS_H/2)>70) break;
        }while(tries<16);
        const cg = new WeaponItem(x,y,'carregada');
        cg.spawnDelay=360;
        rc.items.push(cg);
      }
    }
    // Garante pelo menos um Item Especial (E) por andar para testar mecânica (inclui Power Star raro na Fase 5)
    const hasSpecial = rooms.some(r=> r.items.some(it=> it.isSpecialPickup));
    if(!hasSpecial){
      const candidates = rooms.filter(r=>!r.isStart && !r.isExit && !r.isRare && !r.isMiniboss && !r.isBossStair && !r.isPartyHorde);
      if(candidates.length){
        const filtered = candidates.filter(r=> r.items.length < 3);
        const pool = filtered.length ? filtered : candidates;
        const rc = pool[Math.floor(rng()*pool.length)];
        let x,y,tries=0;
        do{
          x=randRange(140, CANVAS_W-140);
          y=randRange(110, CANVAS_H-110);
          tries++;
          let onWall=false;
          for(const w of rc.walls) if(rectCollide(x-10,y-10,20,20,w.x,w.y,w.w,w.h)) {onWall=true;break;}
          if(!onWall && dist(x,y,CANVAS_W/2,CANVAS_H/2)>70) break;
        }while(tries<16);
        // Garante variedade: inclui Flecha Stand incomum (40% chance), alterna entre 3
        const rS=rng();
        let specialId;
        if(rS<0.30) specialId='espada_flamejante';
        else if(rS<0.60) specialId='escudo_magico';
        else specialId='flecha_stand';
        const sp = new SpecialItemPickup(x,y, specialId);
        sp.spawnDelay = 360;
        rc.items.push(sp);
      }
    }

    return { rooms, roomLookup, startRoom: roomLookup.get(key(startX,startY)), seed: this.seed, grid:{w:gridW,h:gridH}, exitRoom, floor:this.floor };
  }
}

// ===================== FUNÇÃO drawHealth =====================
// Agora suporta Bone Hearts (recipientes cinza/cibernéticos) no final da barra.
// hp/maxHp incluem HP dentro dos ossos (top layer no final). boneHearts = número de recipientes cinza.
// Visual Bone: base metálica escura + interior ciano acinzentado, preservando identidade Cibernética mas distinguível como recipiente.
function drawHealth(ctx, x, y, hp, maxHp=6, boneHearts=0) {
  const totalHearts = maxHp / 2;
  const size = 22, gap = 28;
  const totalBone = boneHearts|0;
  for(let i=0;i<totalHearts;i++){
    const hx = x + i*gap, hy = y;
    const heartHp = clamp(hp - i*2, 0, 2);
    const isBone = i >= totalHearts - totalBone; // ossos no final (direita)
    ctx.save(); ctx.translate(hx, hy);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; drawHeartPath(ctx, 1, 2, size); ctx.fill();
    if(isBone){
      // Bone Heart - base escura metálica
      ctx.fillStyle = '#1a2530'; drawHeartPath(ctx, 0, 0, size); ctx.fill();
      ctx.strokeStyle = '#4a6a7a'; ctx.lineWidth = 1.4; ctx.stroke();
      // ossinho decorativo lateral (pequeno detalhe)
      // preenche conforme heartHp
      if (heartHp >= 2) {
        ctx.fillStyle = '#8ecae6'; drawHeartPath(ctx, 0, 0, size); ctx.fill();
        // brilho ciano
        ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.arc(6, 5, 2.2, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(160,220,255,0.35)'; ctx.beginPath(); ctx.arc(9, 8, 1.1, 0, Math.PI*2); ctx.fill();
        // borda ciano pulsante sutil
        ctx.strokeStyle = 'rgba(0,229,255,0.55)'; ctx.lineWidth = 1.1; drawHeartPath(ctx, 0, 0, size); ctx.stroke();
      } else if (heartHp === 1) {
        ctx.save(); ctx.beginPath(); drawHeartPath(ctx, 0, 0, size); ctx.clip();
        ctx.fillStyle = '#8ecae6'; ctx.fillRect(0, 0, size/2 + 0.5, size); ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(6, 6, 1.6, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,229,255,0.45)'; ctx.lineWidth = 1.1; drawHeartPath(ctx, 0, 0, size); ctx.stroke();
      } else {
        // vazio - osso quebrado/vazio: só contorno escuro com rachadura
        ctx.strokeStyle = 'rgba(140,160,180,0.18)'; ctx.lineWidth = 1; ctx.beginPath();
        ctx.moveTo(size*0.5, 4); ctx.lineTo(size*0.5 -2, 8); ctx.lineTo(size*0.5 +1, 11); ctx.lineTo(size*0.5, 15); ctx.stroke();
        // rachadura horizontal sutil
        ctx.strokeStyle = 'rgba(140,160,180,0.12)'; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(5, 8); ctx.lineTo(size-5, 10); ctx.stroke();
      }
    } else {
      // Coração vermelho normal
      ctx.fillStyle = '#2a1a1a'; drawHeartPath(ctx, 0, 0, size); ctx.fill();
      ctx.strokeStyle = '#5a2a2a'; ctx.lineWidth = 1.5; ctx.stroke();
      if (heartHp >= 2) { ctx.fillStyle = '#ff3b30'; drawHeartPath(ctx, 0, 0, size); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(6, 5, 2.5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(9, 8, 1.2, 0, Math.PI*2); ctx.fill();
      } else if (heartHp === 1) {
        ctx.save(); ctx.beginPath(); drawHeartPath(ctx, 0, 0, size); ctx.clip();
        ctx.fillStyle = '#ff3b30'; ctx.fillRect(0, 0, size/2 + 0.5, size); ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(6, 6, 1.8, 0, Math.PI*2); ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; ctx.beginPath();
        ctx.moveTo(size*0.5, 4); ctx.lineTo(size*0.5 -2, 8); ctx.lineTo(size*0.5 +1, 11); ctx.lineTo(size*0.5, 15); ctx.stroke();
      }
    }
    ctx.restore();
  }
}
function drawHeartPath(ctx, ox, oy, s) {
  const w = s, h = s;
  ctx.beginPath();
  ctx.moveTo(ox + w*0.5, oy + h*0.78);
  ctx.bezierCurveTo(ox + w*0.1, oy + h*0.45, ox + 0, oy + h*0.25, ox + w*0.25, oy + h*0.15);
  ctx.bezierCurveTo(ox + w*0.35, oy + h*0.08, ox + w*0.5, oy + h*0.18, ox + w*0.5, oy + h*0.28);
  ctx.bezierCurveTo(ox + w*0.5, oy + h*0.18, ox + w*0.65, oy + h*0.08, ox + w*0.75, oy + h*0.15);
  ctx.bezierCurveTo(ox + w, oy + h*0.25, ox + w*0.9, oy + h*0.45, ox + w*0.5, oy + h*0.78);
  ctx.closePath();
}

// ===================== GAME =====================
class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.input = new InputHandler();
    this.state = 'MENU';
    this.rooms = [];
    this.roomLookup = new Map();
    this.currentRoom = null;
    this.exitRoom = null;
    this.player = new Player(CANVAS_W/2, CANVAS_H/2);
    this.bullets = []; // player + enemy bullets juntos (owner diferencia)
    this.meleeSwings = []; // ataques corpo a corpo ativos
    this.fists = []; // punhos foguete ativos
    this.bastaoProjectiles = []; // JG - bastões arremessados (sem duplicação, máximo 1 ativo)
    this.lazerBeams = []; // LAZER CODIFICADO - feixes Brimstone retangulares ondulados
    this.particles = [];
    this.allies = []; // aliados Stand da Flecha (temporários)
    this.gatoAntivirus = []; // Gato Antivírus azul (companheiro incomum persistente)
    this.oliPieces = []; // Oli - peças de xadrez (Torre/Bispo/Rainha/Rei)
    this.oliPawns = []; // Oli - peões invocados pelo Rei
    this.selectedCharacterId = null; // escolhido no seletor
    this.seed = 0;
    this.floor = 1;
    this.maxFloor = 5; // FASE 5 Boss da Sala da Escada (FINAL) + Hacker secreto
    this.roomsExplored = 0;
    this.enemiesDefeated = 0;
    this.lastTime = 0;
    this.transitionCooldown = 0;
    this.shake = 0;
    this.floorTransitioning = false;
    this.hackerArena=null;
    this._hackerTransition=false;
    this.motosserraZone=null;

    this.menuScreen = document.getElementById('menuScreen');
    this.controlsScreen = document.getElementById('controlsScreen');
    this.characterScreen = document.getElementById('characterScreen');
    this.gameOverScreen = document.getElementById('gameOverScreen');
    this.pauseScreen = document.getElementById('pauseScreen');
    this.gameContainer = document.getElementById('gameContainer');
    this.hudEnemies = document.getElementById('hudEnemies');
    this.hudRoom = document.getElementById('hudRoom');
    this.hudFloor = document.getElementById('hudFloor');
    this.hudDashFill = document.getElementById('dashFill');
    this.hudSeed = document.getElementById('hudSeed');
    this.hudHeartsDom = document.getElementById('hudHearts');
    this.hudWeapon = document.getElementById('weaponName');
    this.toast = document.getElementById('toast');
    this.swapHint = document.getElementById('swapHint');
    this.tempBar = document.getElementById('tempBar');
    this.tempFill = document.getElementById('tempFill');
    this.tempLabel = document.getElementById('tempLabel');
    this.chargeBar = document.getElementById('chargeBar');
    this.chargeFill = document.getElementById('chargeFill');
    this.chargeLabel = document.getElementById('chargeLabel');
    this.luvaBar = document.getElementById('luvaBar');
    this.luvaFill = document.getElementById('luvaFill');
    this.luvaLabel = document.getElementById('luvaLabel');
    this.upgradeHud = document.getElementById('upgradeHud');
    this.upgradeList = document.getElementById('upgradeList');
    // HUD Itens Especiais (E + cooldown)
    this.specialHud = document.getElementById('specialHud');
    this.specialName = document.getElementById('specialName');
    this.specialStatus = document.getElementById('specialStatus');
    this.specialFill = document.getElementById('specialFill');
    this.specialCircle = document.getElementById('specialCircle');
    this.specialIcon = document.getElementById('specialIcon');
    this._hudIdleTimer=0;

    this.bindUI();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    requestAnimationFrame((t)=>this.loop(t));
  }
  bindUI() {
    // Menu próprio de seleção de personagem (modular, sem duplicar)
    const charCards = document.querySelectorAll('.char-card');
    const btnPlay = document.getElementById('btnPlay');
    const btnPlayChar = document.getElementById('btnPlayChar');
    const btnCharBack = document.getElementById('btnCharBack');
    const hint = document.getElementById('characterHint');
    const selectChar = (id) => {
      this.selectedCharacterId = id;
      charCards.forEach(c=> c.classList.toggle('selected', c.dataset.char===id));
      if(btnPlayChar) btnPlayChar.disabled=false;
      if(hint){
        const def=getCharacterDef(id);
        hint.textContent=`✔ ${def.displayName} selecionado • ${def.description}`;
        hint.classList.add('ready');
      }
    };
    charCards.forEach(card=>{
      const id=card.dataset.char;
      const handler=(e)=>{
        e.preventDefault();
        selectChar(id);
      };
      card.addEventListener('click', handler);
      card.addEventListener('keydown', (e)=>{
        if(e.key==='Enter' || e.key===' '){
          e.preventDefault();
          selectChar(id);
        }
      });
    });
    // Atalhos 1-4 quando seleção aberta, ou abre seleção direto do menu
    window.addEventListener('keydown', (e)=>{
      if(this.characterScreen && this.characterScreen.classList.contains('active')){
        if(e.key==='1') selectChar('jg');
        else if(e.key==='2') selectChar('kinight');
        else if(e.key==='3') selectChar('jl');
        else if(e.key==='4') selectChar('neutro');
        else if(e.key==='5') selectChar('oli');
        else if(e.key==='6') selectChar('ash');
        else if(e.key==='7') selectChar('dev');
        else if(e.key==='Escape'){ this.hideCharacterSelect(); }
      } else if(this.state==='MENU' && !this.controlsScreen.classList.contains('active') && !(this.characterScreen && this.characterScreen.classList.contains('active'))){
        if(e.key==='1'){ this.showCharacterSelect(); selectChar('jg'); }
        else if(e.key==='2'){ this.showCharacterSelect(); selectChar('kinight'); }
        else if(e.key==='3'){ this.showCharacterSelect(); selectChar('jl'); }
        else if(e.key==='4'){ this.showCharacterSelect(); selectChar('neutro'); }
        else if(e.key==='5'){ this.showCharacterSelect(); selectChar('oli'); }
        else if(e.key==='6'){ this.showCharacterSelect(); selectChar('ash'); }
        else if(e.key==='7'){ this.showCharacterSelect(); selectChar('dev'); }
      }
    });
    if(btnPlay){
      btnPlay.addEventListener('click', ()=> this.showCharacterSelect());
    }
    if(btnCharBack){
      btnCharBack.addEventListener('click', ()=> this.hideCharacterSelect());
    }
    if(btnPlayChar){
      btnPlayChar.addEventListener('click', ()=>{
        if(!this.selectedCharacterId){
          if(hint){ hint.textContent='⚠️ Selecione um personagem primeiro'; hint.classList.remove('ready'); }
          charCards.forEach(c=>{ c.style.transform='scale(0.98)'; setTimeout(()=>c.style.transform='', 180); });
          return;
        }
        this.startGame(this.selectedCharacterId);
      });
    }
    document.getElementById('btnPlayAgain').addEventListener('click', ()=>{
      const fallback = this.selectedCharacterId || this.player.characterId || 'neutro';
      this.startGame(fallback);
    });
    document.getElementById('btnGoMenu').addEventListener('click', ()=> this.goMenu());
    document.getElementById('btnControls').addEventListener('click', ()=> this.showControls());
    document.getElementById('btnBackMenu').addEventListener('click', ()=> this.hideControls());
    // Pause menu
    const btnPause=document.getElementById('btnPause');
    if(btnPause) btnPause.addEventListener('click', ()=> this.togglePause());
    document.getElementById('btnResume').addEventListener('click', ()=> this.resume());
    document.getElementById('btnRestartRun').addEventListener('click', ()=> { this.hidePause(); const cid=this.selectedCharacterId||this.player.characterId||'neutro'; this.startGame(cid); });
    document.getElementById('btnPauseControls').addEventListener('click', ()=> {
      // Funcional: mostra controles por cima do pause e exibe o que os itens equipados fazem
      if(this.state==='PAUSED'){
        this.pauseScreen.classList.remove('active');
        this._controlsReturnToPause = true;
      }
      this.showControls();
    });
    document.getElementById('btnPauseMenu').addEventListener('click', ()=> { this.hidePause(); this.goMenu(); });
    window.addEventListener('keydown', (e)=>{
      // ESC fecha controles/personagem primeiro, depois pausa
      if(e.key==='Escape' && this.characterScreen && this.characterScreen.classList.contains('active')){ this.hideCharacterSelect(); return; }
      if(e.key==='Escape' && this.controlsScreen.classList.contains('active')){ this.hideControls(); return; }
      if(e.key==='Escape' && this.pauseScreen && this.pauseScreen.classList.contains('active')){ this.resume(); return; }
      const isPauseKey = e.key==='Escape' || e.key.toLowerCase()==='p';
      if(isPauseKey && this.state==='PLAYING'){ e.preventDefault(); this.pause(); }
      else if(isPauseKey && this.state==='PAUSED'){ e.preventDefault(); this.resume(); }
    });
    // Toggle info extra no topo (recolher/expandir) - libera mapa
    const btnToggleHud=document.getElementById('btnToggleHud');
    const hudExtra=document.querySelector('.hud-top-extra');
    const hudBottom=document.querySelector('.hud-bottom');
    const toggleTarget = hudExtra || hudBottom;
    if(btnToggleHud && toggleTarget){
      btnToggleHud.addEventListener('click', ()=>{
        toggleTarget.classList.toggle('collapsed');
        const isCollapsed = toggleTarget.classList.contains('collapsed');
        btnToggleHud.textContent = isCollapsed ? '≡' : '×';
        // também recolhe bottom se existir (compatibilidade)
        if(hudBottom && hudBottom!==toggleTarget) hudBottom.classList.toggle('collapsed', isCollapsed);
      });
    }
  }
  showCharacterSelect(){
    if(this.characterScreen){
      this.characterScreen.classList.add('active');
      this.menuScreen.classList.remove('active');
    }
  }
  hideCharacterSelect(){
    if(this.characterScreen){
      this.characterScreen.classList.remove('active');
      this.menuScreen.classList.add('active');
    }
  }
  showControls(){
    // Atualiza loadout dinâmico antes de mostrar
    this.updateControlsLoadout();
    this.controlsScreen.classList.add('active');
    // Garante que controles fique por cima do pause quando aberto via pause
    if(this._controlsReturnToPause){
      this.controlsScreen.style.zIndex = '30';
    } else {
      this.controlsScreen.style.zIndex = '';
    }
  }
  hideControls(){
    this.controlsScreen.classList.remove('active');
    this.controlsScreen.style.zIndex = '';
    // Se veio do pause, volta ao pause
    if(this._controlsReturnToPause && this.state==='PAUSED'){
      this._controlsReturnToPause = false;
      if(this.pauseScreen) this.pauseScreen.classList.add('active');
    } else {
      this._controlsReturnToPause = false;
    }
  }
  // Atualiza o banner de loadout dentro da tela de controles (mostra o que os itens equipados fazem)
  updateControlsLoadout(){
    const loadoutEl = document.getElementById('controlsLoadout');
    const charEl = document.getElementById('loadoutCharacter');
    const contentEl = document.getElementById('loadoutContent');
    if(!loadoutEl || !contentEl) return;
    // Só mostra quando em partida (PLAYING/PAUSED) e com personagem definido
    const p = this.player;
    const hasGame = p && p.characterId && (this.state==='PLAYING' || this.state==='PAUSED' || this._controlsReturnToPause);
    if(!hasGame){
      loadoutEl.style.display='none';
      loadoutEl.classList.add('hidden');
      return;
    }
    loadoutEl.style.display='flex';
    loadoutEl.classList.remove('hidden');
    const charDef = p.characterDef || getCharacterDef(p.characterId);
    if(charEl && charDef){
      charEl.textContent = `${charDef.icon} ${charDef.displayName} • ${charDef.maxHp/2} ♥`;
      charEl.style.borderColor = charDef.border;
      charEl.style.color = charDef.color;
      charEl.style.background = charDef.bg;
    }
    // Monta cards do loadout: Arma, Especial, Passivos
    const cards=[];
    // Arma atual
    if(p.weapon){
      const w=p.weapon;
      let wDesc='';
      if(w.name==='BASTAO') wDesc=`Dano ${w.damage} • Alcance ${w.range} • Arremesso ${w.throwDamage||w.heavyDamage} dmg • Gira e retorna`;
      else if(w.name==='ESPADA') wDesc=`Dano ${w.damage} • Pesado ${w.heavyDamage} • Alcance ${w.range}/${w.heavyRange} • Combo 3 golpes`;
      else if(w.name==='NORMAL') wDesc=`Dano ${w.damage} • Alcance ${w.range} • ${p.hasDoubleShot?'Tiro duplo ativo':''}`;
      else wDesc=`Dano ${w.damage} • Alcance ${w.range} • Cooldown ${w.cooldown}ms`;
      const sec = p.secondaryWeapon ? ` + Sec: ${p.secondaryWeapon.name}` : '';
      cards.push({
        icon: w.name==='BASTAO'?'🏏': w.name==='ESPADA'?'⚔️': w.name==='NORMAL'?'🔫': w.name==='SHOTGUN'?'💥': w.name==='RAIO'?'⚡': w.name==='LUVA'?'🥊': w.name==='BAZUCA'?'🚀': '🔫',
        name: `ARMA: ${w.name}${sec}`,
        desc: wDesc,
        badge: w.name,
        color: charDef ? charDef.color : '#ffcc00',
        border: charDef ? charDef.border : 'rgba(255,204,0,0.22)'
      });
    }
    // Especial equipado
    if(p.equippedSpecial){
      const sp=p.equippedSpecial;
      let status='';
      if(sp.isActive) status=`ATIVO: ${Math.ceil(sp.durationRemaining/1000)}s`;
      else if(sp.isOnCooldown()) status=`Recarga: ${sp.getRemainingSeconds()}s`;
      else status='Pronto [E]';
      cards.push({
        icon: sp.icon||'★',
        name: `ESPECIAL: ${sp.name}`,
        desc: `${sp.description} • ${status} • Cooldown ${Math.round(sp.cooldown/1000)}s`,
        badge: sp.isActive?'ATIVO': sp.isOnCooldown()?'RECARGA':'PRONTO',
        color: sp.color||'#ffd700',
        border: sp.color? `${sp.color}44` : 'rgba(255,215,0,0.22)'
      });
    } else {
      cards.push({
        icon: '—',
        name: 'ESPECIAL: NENHUM',
        desc: 'Sem item especial equipado. Explore salas e pegue com [E] quando próximo (58px).',
        badge: 'VAZIO',
        color: '#8a8198',
        border: 'rgba(138,129,152,0.22)'
      });
    }
    // Passivos
    const passives=[];
    if(p.hasFlameTrail) passives.push('🔥 Rastro de Fogo (dash deixa fogo 3.2s)');
    if(p._hasSwiftBoots) passives.push('💨 Botas Velozes (+0.75 vel)');
    if(p.hasDoubleShot) passives.push('✦ Tiro Duplo (NORMAL x2)');
    if(p.farmarAuraActive) passives.push('67 Aura ativa (dano+empurrão)');
    if(p.hasBastao===false && p.characterId==='jg') passives.push('🏏 Sem bastão (lento)');
    else if(p.hasBastao && p.characterId==='jg') passives.push('🏏 Com bastão (rápido)');
    if(passives.length){
      cards.push({
        icon: '🎒',
        name: 'PASSIVOS',
        desc: passives.join(' • '),
        badge: `${passives.length} ATIVOS`,
        color: '#4ade80',
        border: 'rgba(74,222,128,0.22)'
      });
    }
    // Melhorias (mostra até 2 mais recentes)
    if(p.obtainedUpgrades && p.obtainedUpgrades.size>0){
      const last = Array.from(p.obtainedUpgrades).slice(-2);
      const names = last.map(id=>{
        const def=UPGRADE_MAP.get(id);
        return def? `${def.name} (${def.rarity})` : id;
      }).join(' • ');
      cards.push({
        icon: '⬆️',
        name: `MELHORIAS: ${p.obtainedUpgrades.size} níveis`,
        desc: names,
        badge: 'UPGRADES',
        color: '#c084fc',
        border: 'rgba(192,132,252,0.22)'
      });
    }
    // Renderiza
    contentEl.innerHTML = cards.map(c=>`
      <div class="loadout-card" style="border-color:${c.border}; background:${c.color}12">
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="loadout-card-icon">${c.icon}</span>
          <span class="loadout-card-name">${c.name}</span>
          <span class="loadout-card-badge" style="color:${c.color}; border-color:${c.border}; background:${c.color}14">${c.badge}</span>
        </div>
        <span class="loadout-card-desc">${c.desc}</span>
      </div>
    `).join('');
  }
  // Pausa durante a partida - pode ver itens coletados e resetar
  pause(){
    if(this.state!=='PLAYING') return;
    if(this.bossDialogActive) return; // não pausa durante diálogo do boss
    this.state='PAUSED';
    if(this.pauseScreen) this.pauseScreen.classList.add('active');
    this.updatePauseInfo();
  }
  resume(){
    if(this.state!=='PAUSED') return;
    this.state='PLAYING';
    if(this.pauseScreen) this.pauseScreen.classList.remove('active');
    this.lastTime = performance.now();
  }
  togglePause(){
    if(this.state==='PLAYING') this.pause();
    else if(this.state==='PAUSED') this.resume();
  }
  hidePause(){
    if(this.pauseScreen) this.pauseScreen.classList.remove('active');
    if(this.state==='PAUSED') this.state='PLAYING';
  }
  updatePauseInfo(){
    if(!this.pauseScreen) return;
    const info=document.getElementById('pauseInfo');
    if(info) info.textContent=`FASE ${this.floor} • ${FLOOR_THEMES[this.floor]?FLOOR_THEMES[this.floor].name:''} • SALA ${this.currentRoom?`${this.currentRoom.gx},${this.currentRoom.gy}`:'-'} • SEED ${this.seed}`;
    const hearts=document.getElementById('pauseHearts');
    if(hearts && this.player) hearts.textContent=`${this.player.hp}/${this.player.maxHp} ♥`;
    const wEl=document.getElementById('pauseWeapon');
    if(wEl && this.player && this.player.weapon){
      let txt=this.player.weapon.name;
      if(this.player.secondaryWeapon) txt+=` + ${this.player.secondaryWeapon.name}`;
      if(this.player.hasFlameTrail) txt+=' 🔥';
      if(this.player._hasSwiftBoots) txt+=' 💨';
      wEl.textContent=txt;
    }
    const ene=document.getElementById('pauseEnemies');
    if(ene) ene.textContent=`${this.currentRoom?this.currentRoom.enemies.length:0} na sala • ${this.rooms?this.rooms.reduce((a,r)=>a+r.enemies.length,0):0} total`;
    this.renderPauseCollected();
    this.renderPauseWeapons();
  }
  renderPauseCollected(){
    const container=document.getElementById('pauseCollected');
    const countEl=document.getElementById('pauseCollectedCount');
    if(!container || !this.player) return;
    const items=[];
    // Passivos
    if(this.player.hasFlameTrail) items.push({icon:'🔥', name:'Rastro de Fogo', desc:'Dash deixa fogo 3.2s (1 dano/420ms)', badge:'PASSIVO', color:'#ff6a00'});
    if(this.player._hasSwiftBoots) items.push({icon:'💨', name:'Botas Velozes', desc:'+0.75 velocidade', badge:'PASSIVO', color:'#00d9ff'});
    if(this.player.hasDoubleShot) items.push({icon:'✦', name:'Tiro Duplo', desc:'NORMAL dispara 2 projéteis lado a lado', badge:'MELHORIA', color:'#5a8fd4'});
    // Especial equipado
    if(this.player.equippedSpecial){
      const sp=this.player.equippedSpecial;
      items.push({icon:sp.icon||'★', name:sp.name, desc:sp.description||'Item especial [E]', badge:'ESPECIAL', color:sp.color||'#ffd700'});
    }
    // Upgrades (melhorias) - lista todas
    if(this.player.obtainedUpgrades && this.player.obtainedUpgrades.size>0){
      for(const id of this.player.obtainedUpgrades){
        const def=UPGRADE_MAP.get(id);
        if(!def) continue;
        const lvl=this.player.upgradeLevels.get(id)||1;
        const maxLvl=def.maxLevel||1;
        const lvlStr=maxLvl>1?` Nv${lvl}/${maxLvl}`:'';
        const r=RARITY[def.rarity];
        items.push({icon:'★', name:def.name+lvlStr, desc:def.desc, badge:def.rarity, color:r?r.color:'#d1d5db'});
      }
    }
    // All-level upgrades que estão em upgradeLevels mas não em obtainedUpgrades (fallback)
    if(this.player.upgradeLevels){
      for(const [id,lvl] of this.player.upgradeLevels){
        if(this.player.obtainedUpgrades.has(id)) continue;
        const def=UPGRADE_MAP.get(id);
        if(!def) continue;
        const maxLvl=def.maxLevel||1;
        items.push({icon:'★', name:def.name+` Nv${lvl}/${maxLvl}`, desc:def.desc, badge:def.rarity, color:(RARITY[def.rarity]||{}).color||'#d1d5db'});
      }
    }
    if(countEl) countEl.textContent=`${items.length} ${items.length===1?'item':'itens'}`;
    if(items.length===0){
      container.innerHTML='<p class="pause-empty">Nenhum item coletado ainda. Explore as salas!<br><span style="font-size:10px;opacity:0.7">Armas no chão [Q] • Especiais [E] • Melhorias ★</span></p>';
      return;
    }
    container.innerHTML = items.map(it=>`
      <div class="pause-item" style="border-color:${it.color}22">
        <div class="pause-item-icon" style="color:${it.color}; border-color:${it.color}33">${it.icon}</div>
        <div class="pause-item-info">
          <span class="pause-item-name">${it.name}</span>
          <span class="pause-item-desc">${it.desc}</span>
        </div>
        <span class="pause-item-badge" style="color:${it.color}; border-color:${it.color}44; background:${it.color}14">${it.badge}</span>
      </div>
    `).join('');
  }
  renderPauseWeapons(){
    const cont=document.getElementById('pauseWeapons');
    if(!cont || !this.player) return;
    const prim=this.player.primaryWeapon;
    const sec=this.player.secondaryWeapon;
    const cur=this.player.weapon;
    const mk=(w, label)=>{
      if(!w) return '';
      const isCur=w===cur;
      const stats=[];
      if(w.damage) stats.push(`${w.damage} dano`);
      if(w.range) stats.push(`${w.range} alcance`);
      if(w.cooldown) stats.push(`${w.cooldown}ms`);
      if(w.hasDoubleShot) stats.push('x2');
      const disp = w.displayName || (w.name==='RAIO_MATEMATICO' ? 'LAZER CODIFICADO' : w.name);
      return `<div class="pause-weapon-card ${isCur?'active':''}">
        <span class="pause-weapon-name">${disp} ${isCur?'●':''} <span style="font-size:8px;opacity:0.6">${label}</span></span>
        <span class="pause-weapon-stats">${stats.join(' • ')}</span>
      </div>`;
    };
    let html='';
    html+=mk(prim,'PRIMÁRIA');
    html+=mk(sec,'SECUNDÁRIA');
    if(!prim && !sec) html='<p class="pause-empty" style="padding:8px">Sem armas</p>';
    cont.innerHTML=html;
  }
  goMenu(){
    this.state='MENU';
    this.hidePause();
    this.gameOverScreen.classList.remove('active');
    this.gameContainer.classList.add('hidden');
    this.menuScreen.classList.add('active');
    if(this.characterScreen) this.characterScreen.classList.remove('active');
    if(this.controlsScreen) this.controlsScreen.classList.remove('active');
    this.gameContainer.classList.remove('phase2');
    this.gameContainer.classList.remove('phase3');
    this.gameContainer.classList.remove('phase4');
    this.gameContainer.classList.remove('phase5');
    this.hideBossDialog();
  }
  resizeCanvas(){ const dpr=Math.min(window.devicePixelRatio||1,2); }

  startGame(characterId=null){
    // Modular: aceita characterId do seletor; fallback para seleção anterior ou JL padrão
    const chosen = characterId || this.selectedCharacterId || 'jl';
    const def = getCharacterDef(chosen);
    if(!def){
      console.warn('Personagem inválido', chosen, 'usando jl');
      this.selectedCharacterId='jl';
    } else {
      this.selectedCharacterId=def.id;
    }
    this.seed = Math.floor(Math.random()*1e9);
    this.floor = 1;
    this.totalEnemiesDefeated = 0;
    // reset completo do jogador (armas, passivos, melhorias) - Bone Heart: reseta recipientes cinza
    // Inclui suporte a BASTAO no weaponUpgrades modular
    this.player.weaponUpgrades = { NORMAL:[], SHOTGUN:[], RAIO:[], RAIO_MATEMATICO:[], METRALHADORA:[], CARREGADA:[], BAZUCA:[], ESPADA:[], LUVA:[], MOTOSSERRA:[], BASTAO:[], ALL:[], SPECIAL:[] };
    this.player.obtainedUpgrades = new Set();
    this.player.upgradeLevels = new Map();
    // Aplica personagem de forma modular (não duplica lógica, prepara para novos)
    // define vida, arma inicial, especial, flags exclusivas
    applyCharacterToPlayer(this.player, this.selectedCharacterId);
    this.player.hasFlameTrail = false;
    this.player.hasDoubleShot = false;
    if(this.player.primaryWeapon) this.player.primaryWeapon.hasDoubleShot = false;
    this.player._hasSwiftBoots = false;
    this.player.speed = PLAYER_SPEED;
    this.player.baseSpeed = PLAYER_SPEED;
    this.player.miniHeat = 0; this.player.isOverheated=false; this.player.overheatTimer=0;
    this.player.chargeTime = 0; this.player.isCharging=false; this.player.chargeDir=null; this.player._lastChargeProgress=0;
    // Dev RayMatematico reset
    this.player.rayMatematicoChargeTime = 0; this.player.isRayMatematicoCharging=false; this.player.rayMatematicoChargeDir=null; this.player._lastRayMatematicoProgress=0;
    if(this.player.rayMatematicoFiredThresholds) this.player.rayMatematicoFiredThresholds.clear();
    this.player.rayMatematicoReady=false;
    this.player.swordChargeTime=0; this.player.isSwordCharging=false; this.player.swordChargeDir=null; this.player.swordHeavyReady=false;
    this.player.swordCombo=0; this.player.swordComboTimer=0;
    this.player.swordGuardianActive=false; this.player.swordGuardianCharges=0; this.player.swordGuardianTimer=0;
    this.player.motosserraCharge=0; this.player.motosserraChargeMax=MOTOSSERRA_CHARGE_MAX; this.player.motosserraIdleTimer=0;
    this.player.activeFist=null; this.player.activeFists=[]; this.player.meleeAnim=0;
    // JG bastão já aplicado via applyCharacterToPlayer, mas garante hasBastao true no início
    if(this.player.characterId==='jg'){
      this.player.hasBastao=true;
      this.player.bastaoProjectile=null;
      this.player.isBastaoCharging=false;
    }
    this.bullets=[]; this.meleeSwings=[]; this.fists=[]; this.bastaoProjectiles=[]; this.lazerBeams=[]; this.particles=[]; this.allies=[]; this.gatoAntivirus=[]; this.oliPieces=[]; this.oliPawns=[];
    this.player.didDashThisFrame = false;
    this._lastHp = undefined; this._lastWeapon = undefined; this._lastDoubleShot = undefined;
    this._hasFlameNotified = false;
    this._lastUpgradeCount = 0;
    this._lastUpgradeLevels = new Map();
    // Itens especiais: preserva equipado do personagem (JL = Farmar Aura 67). Não limpa se já veio do applyCharacter
    // Para JG/Kinight já está null via applyCharacter, para JL mantém. Evita duplicação e mantém exclusivo
    if(this.player.characterId==='jl' && !this.player.equippedSpecial){
      const sp=createSpecialItem('farmar_aura');
      if(sp) this.player.equipSpecial(sp);
    } else if(this.player.characterId!=='jl' && this.player.equippedSpecial && this.player.equippedSpecial.id==='farmar_aura'){
      // Se não é JL mas tem farmar_aura (ex debug), limpa para manter exclusivo
      this.player.equippedSpecial=null;
    }
    if(this.player.characterId==='oli' && !this.player.equippedSpecial){
      const sp=createSpecialItem('oli_xadrez');
      if(sp) this.player.equipSpecial(sp);
    } else if(this.player.characterId!=='oli' && this.player.equippedSpecial && this.player.equippedSpecial.id==='oli_xadrez'){
      this.player.equippedSpecial=null;
    }
    // Reseta flags de escudo/power mas mantém equipado
    this.player.shieldActive = false;
    this.player.shieldReduction = 0;
    this.player.shieldCharges = 0;
    this._lastSpecialId = this.player.equippedSpecial ? this.player.equippedSpecial.id : null;
    this._lastSpecialCooldown = -1;
    this._lastFlechaAbility = null;
    this.player.hasGatoAntivirus = false; // reseta passiva gato no novo jogo
    this.allies = []; // limpa aliados
    this.gatoAntivirus = []; // limpa gato antivírus
    this.player.powerStarActive = false;
    this.player.powerStarTimer = 0;
    if(this.player.powerStarHitTimers) this.player.powerStarHitTimers.clear();
    this.bossDialogActive = false;
    this.hideBossDialog();
    // // DEBUG: já começa com Espada Flamejante equipada para testar E imediatamente (comente se quiser começar sem)
    // this.player.equipSpecial(createSpecialItem('espada_flamejante'));
    // // DEBUG Flecha: this.player.equipSpecial(createSpecialItem('flecha_stand'));
    // // DEBUG Power Star: this.player.equipSpecial(createSpecialItem('power_star'));
    this.generateFloor(this.floor, this.seed);
    this.menuScreen.classList.remove('active');
    if(this.characterScreen) this.characterScreen.classList.remove('active');
    this.controlsScreen.classList.remove('active');
    this.gameOverScreen.classList.remove('active');
    if(this.pauseScreen) this.pauseScreen.classList.remove('active');
    this.gameContainer.classList.remove('hidden');
    this.state='PLAYING';
    const defStart=getCharacterDef(this.selectedCharacterId);
    const charInfo=defStart ? ` • ${defStart.icon} ${defStart.displayName}` : '';
    this.showToast(`Cyber Requiem • Ato 1 - Porão${charInfo} • Seed ${this.seed} • ${this.rooms.length} salas`);
  }

  generateFloor(floor, seed){
    const genSeed = seed ?? Math.floor(Math.random()*1e9);
    this.seed = genSeed;
    const gen = new MapGenerator(genSeed, floor);
    const map = gen.generate();
    this.rooms = map.rooms;
    this.roomLookup = map.roomLookup;
    this.currentRoom = map.startRoom;
    this.exitRoom = map.exitRoom;
    this.currentRoom.visited = true;
    this.roomsExplored = 1;
    this.enemiesDefeated = 0;
    // preserva vida e arma ao avançar; reset ao iniciar floor 1 já feito
    this.player.x = CANVAS_W/2; this.player.y = CANVAS_H/2;
    this.player.vx=0; this.player.vy=0;
    this.player.dashTimer=0; this.player.dashCooldown=0; this.player.invulnTimer=0; this.player.hurtCooldown=0; this.player.shootCooldown=0;
    this.player.spikeTimer=0;
    this.player.chargeTime=0; this.player.isCharging=false; this.player.chargeDir=null; this.player._lastChargeProgress=0;
    this.player.swordChargeTime=0; this.player.isSwordCharging=false; this.player.swordChargeDir=null; this.player.swordHeavyReady=false;
    if(this.player.isBastaoCharging) this.player.cancelBastaoCharge();
    if(this.player.isCharging) this.player.cancelCharge();
    if(this.player.isSwordCharging) this.player.cancelSwordCharge();
    this.bullets = [];
    this.bastaoProjectiles=[]; this.meleeSwings=[]; this.fists=[]; this.lazerBeams=[];
    this.particles = [];
    this.allies = []; this.gatoAntivirus=[]; this.oliPieces = []; this.oliPawns = []; // aliados, gato e xadrez são por andar, limpa ao trocar de andar (gato respawnará se passiva ativa)
    // Corrige bug da luva presa ao trocar de andar: limpa estado completo
    this.player.activeFists = [];
    this.player.activeFist = null;
    this.player.shootCooldown = 0;
    // JG: garante bastão de volta ao avançar de andar (evita travamento sem bastão)
    if(this.player.characterId==='jg'){
      this.player.hasBastao=true;
      this.player.bastaoProjectile=null;
      this.player.isBastaoCharging=false;
      this.player.bastaoChargeTime=0;
    }
    this.transitionCooldown = 0;
    this.floor = floor;
    this.floorTransitioning=false;
    this.updateFloorVisual();
    this.hudSeed.textContent = `SEED ${this.seed} • F${floor}`;
    // toast específico
    if(floor===1) { /* já mostrado em startGame */ }
    else this.showToast(`➤ Cyber Requiem • Ato ${floor} - ${FLOOR_THEMES[floor].name} • ${this.rooms.length} salas • Rede cibernética instável`, 2600);
  }

  enterHackerRoom(){
    if(this._hackerTransition) return;
    this._hackerTransition=true;
    this.showToast('▓▒ Escada Corrompida ativada... Teleportando para o Dark Vírus ▒▓', 1800);
    for(let i=0;i<22;i++){ const ang=Math.random()*Math.PI*2; this.particles.push(new Particle(this.player.x, this.player.y, Math.cos(ang)*randRange(1.5,4), Math.sin(ang)*randRange(1.5,4), 420, ['#00ff88','#ff0040','#c084fc'][randInt(0,2)], 3)); }
    this.shake=110;
    // cria sala hacker isolada (fora do grid, mas tratada como currentRoom)
    const oldRoom=this.currentRoom;
    // se já existe hackerRoom criado via grid, usa; senão cria nova arena
    let hackerRoom=null;
    // tenta achar sala hacker já gerada no mapa
    hackerRoom=this.rooms.find(r=> r.isHacker);
    if(!hackerRoom){
      // cria arena isolada
      const doors={top:false,bottom:false,left:false,right:false};
      hackerRoom=new Room(0,0,doors,false,()=>Math.random(), 5);
      hackerRoom.makeHackerRoom(()=>Math.random());
      // não adiciona ao rooms para não quebrar grid, mas guarda referência para vitória
      this.hackerArena=hackerRoom;
      // adiciona temporariamente aos rooms para isFloorCleared não quebrar? mantém separado
      // mas para minimapa e transição, adiciona aos rooms
      this.rooms.push(hackerRoom);
      // roomLookup não precisa para arena isolada
    } else {
      hackerRoom.hackerLocked=false;
    }
    setTimeout(()=>{
      this.currentRoom=hackerRoom;
      this.currentRoom.visited=true;
      this.roomsExplored++;
      this.player.x=CANVAS_W/2; this.player.y=CANVAS_H/2+40;
      this.player.vx=0; this.player.vy=0;
      this.bullets=[]; this.meleeSwings=[]; this.fists=[]; this.bastaoProjectiles=[]; this.lazerBeams=[]; this.particles=[];
      this.transitionCooldown=600;
      this._hackerTransition=false;
      this.showToast('◉ HACKER: Fui eu que contaminei seu código com o Dark Vírus! ◉', 2600);
      // glitch explosion na entrada
      for(let k=0;k<28;k++){ const ang=Math.random()*Math.PI*2; this.particles.push(new Particle(this.currentRoom.enemies[0].x, this.currentRoom.enemies[0].y, Math.cos(ang)*randRange(1.5,4), Math.sin(ang)*randRange(1.5,4), 460, '#00ff88',3)); }
      this.shake=90;
    }, 650);
  }
  advanceFloor(){
    if(this.floorTransitioning) return;
    this.floorTransitioning=true;
    this.totalEnemiesDefeated += this.enemiesDefeated;
    // cura parcial ao avançar? Não, mantém vida para desafio; mas dá +1 coração se estiver baixo? Balance: não cura automático, depende de itens
    this.showToast(`✓ Ato ${this.floor} concluído — acesso ao próximo nível liberado...`, 1800);
    // partículas descida
    for(let i=0;i<24;i++){ const ang=Math.random()*Math.PI*2; this.particles.push(new Particle(CANVAS_W/2, CANVAS_H/2, Math.cos(ang)*randRange(1,4), Math.sin(ang)*randRange(2,5), 600, '#ffcc00', 3)); }
    setTimeout(()=>{
      const nextFloor = this.floor + 1;
      if(nextFloor > this.maxFloor){
        // vitória total (todas fases incluindo Fase 5)
        this.state='GAMEOVER';
        const title=document.getElementById('gameOverTitle');
        const stats=document.getElementById('gameOverStats');
        const wasBossVictory = this.currentRoom && this.currentRoom.isBossStair && this.currentRoom.bossStairDefeated;
        const wasHackerVictory = this.rooms.some(r=> r.isHacker && r.hackerDefeated) || (this.hackerArena && this.hackerArena.hackerDefeated) || (this.currentRoom && this.currentRoom.isHacker && this.currentRoom.hackerDefeated);
        const hackerRoomRef=this.rooms.find(r=> r.isHacker && r.hackerDefeated) || this.hackerArena;
        if(wasHackerVictory){
          title.textContent='⭐ HACKER ANIQUILADO ⭐';
          title.style.color='#00ff88';
          const bossPhaseName = (FLOOR_THEMES[5] && FLOOR_THEMES[5].name.trim()) || 'VÍRUS SOMBRIO';
          const allPhases = [1,2,3,4,5].map(i=> (FLOOR_THEMES[i] && FLOOR_THEMES[i].name.trim()) || '').join(', ').replace(/, ([^,]*)$/, ' e $1');
          stats.innerHTML=`você derrotou o criador da escuridão os erros pararam você pode continuar a fazer seu codigo<br><br><span style="color:#00ff88;font-size:13px;letter-spacing:0.8px">Dark Vírus neutralizado • Hacker expurgado</span><br><br>Você venceu o <b>Boss da Escada</b> e o <b>Hacker</b> em <b>Cyber Requiem</b> e estabilizou o <b>${bossPhaseName}</b>!<br>Atos dominados: ${allPhases} + <b>Sala Corrompida</b>!<br><b>${this.roomsExplored}</b> salas finais • <b>${this.totalEnemiesDefeated + this.enemiesDefeated}</b> inimigos • Arma: ${this.player.weapon.name}${this.player.hasFlameTrail?' 🔥':''} ${this.player.powerStarActive?'⭐':''} ${this.player.weapon.hasPochita?' 🪚':''}<br>Seed ${this.seed}<br><span style="color:#8a8198;font-size:12px">Código limpo. O sistema respira novamente.</span>`;
        } else if(wasBossVictory || this.floor===5){
          title.textContent='⭐ REQUIEM CONSUMADO ⭐';
          title.style.color='#ffd700';
          // Cyber Requiem: nomes dos atos
          const bossPhaseName = (FLOOR_THEMES[5] && FLOOR_THEMES[5].name.trim()) || 'VÍRUS SOMBRIO';
          const allPhases = [1,2,3,4,5].map(i=> (FLOOR_THEMES[i] && FLOOR_THEMES[i].name.trim()) || '').join(', ').replace(/, ([^,]*)$/, ' e $1');
          stats.innerHTML=`Sistema purificado com sucesso!<br><span style="color:#ffd700;font-size:15px;letter-spacing:1px">O mundo cibernético está seguro.</span><br><br>Você venceu o <b>Boss da Escada</b> em <b>Cyber Requiem</b> e estabilizou o <b>${bossPhaseName}</b>!<br>Atos dominados: ${allPhases}!<br><b>${this.roomsExplored}</b> salas finais • <b>${this.totalEnemiesDefeated + this.enemiesDefeated}</b> inimigos • Arma: ${this.player.weapon.name}${this.player.hasFlameTrail?' 🔥':''} ${this.player.powerStarActive?'⭐':''}<br>Seed ${this.seed}<br><span style="color:#00ff88;font-size:11px">Dica: Existe uma escada corrompida após o Boss da Escada... Enfrente o Hacker!</span><br><span style="color:#8a8198;font-size:12px">Mundo cibernético estabilizado. Até a próxima incursão.</span>`;
        } else {
          title.textContent='RÉQUIEM PARCIAL!';
          title.style.color='#4ade80';
          const fourPhases = [1,2,3,4].map(i=> (FLOOR_THEMES[i] && FLOOR_THEMES[i].name.trim()) || '').join(', ').replace(/, ([^,]*)$/, ' e $1');
          stats.innerHTML=`Você estabilizou ${fourPhases}!<br><b>${this.roomsExplored}</b> salas finais • <b>${this.totalEnemiesDefeated + this.enemiesDefeated}</b> inimigos • Arma: ${this.player.weapon.name}${this.player.hasFlameTrail?' 🔥':''}<br>Seed ${this.seed}<br><span style="color:#8a8198;font-size:12px">Rede cibernética ainda instável — novo ato o aguarda</span>`;
        }
        this.gameOverScreen.classList.add('active');
        this.floorTransitioning=false;
        return;
      }
      this.generateFloor(nextFloor);
      // flash transition
      this.transitionCooldown=600;
      this.floorTransitioning=false;
      this.state='PLAYING';
    }, 900);
  }

  isFloorCleared(){
    // fase limpa quando todas salas visitadas? Na verdade spec diz após completar primeira fase. Vamos exigir todas salas com inimigos mortos
    // mais simples: todas salas sem inimigos
    return this.rooms.every(r=> r.isCleared());
  }
  updateFloorVisual(){
    this.gameContainer.classList.remove('phase2');
    this.gameContainer.classList.remove('phase3');
    this.gameContainer.classList.remove('phase4');
    this.gameContainer.classList.remove('phase5');
    if(this.floor===2) this.gameContainer.classList.add('phase2');
    else if(this.floor===3) this.gameContainer.classList.add('phase3');
    else if(this.floor===4) this.gameContainer.classList.add('phase4');
    else if(this.floor===5) this.gameContainer.classList.add('phase5');
  }
  // ===== BOSS FASE 5 - Diálogo "Você quer desistir?" =====
  showBossDialog(){
    if(this.bossDialogActive) return;
    this.bossDialogActive = true;
    // Cria overlay se não existir
    let dlg=document.getElementById('bossDialog');
    if(!dlg){
      dlg=document.createElement('div');
      dlg.id='bossDialog';
      dlg.className='boss-dialog';
      dlg.innerHTML=`
        <div class="boss-dialog-panel">
          <div class="boss-dialog-boss">◉ BOSS DA ESCADA ◉</div>
          <p class="boss-dialog-question">Você quer desistir?</p>
          <p class="boss-dialog-hint">O boss aguarda sua resposta no topo da arena.</p>
          <div class="boss-dialog-buttons">
            <button id="bossBtnNo" class="btn btn-primary">✦ NÃO - LUTAR!</button>
            <button id="bossBtnYes" class="btn btn-secondary">☠ SIM - DESISTIR</button>
          </div>
        </div>`;
      document.getElementById('gameContainer').appendChild(dlg);
      // Estilo inline fallback caso CSS não carregue
      dlg.style.cssText='position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.72);backdrop-filter:blur(6px);z-index:30;';
      const panel=dlg.querySelector('.boss-dialog-panel');
      if(panel) panel.style.cssText='background:linear-gradient(180deg,#1e1c2e 0%,#18162a 100%);border:1px solid rgba(255,215,0,0.35);border-radius:14px;padding:22px 18px;text-align:center;max-width:420px;box-shadow:0 16px 48px rgba(0,0,0,0.6);';
    }
    dlg.style.display='flex';
    // Bind buttons (re-bind sempre)
    const btnNo=document.getElementById('bossBtnNo');
    const btnYes=document.getElementById('bossBtnYes');
    if(btnNo) btnNo.onclick=()=> this.answerBossDialog(false);
    if(btnYes) btnYes.onclick=()=> this.answerBossDialog(true);
    // Pausa lógica de jogo (mas ainda renderiza)
    this.showToast('Boss pergunta... Escolha SIM ou NÃO', 3000);
  }
  hideBossDialog(){
    const dlg=document.getElementById('bossDialog');
    if(dlg) dlg.style.display='none';
    this.bossDialogActive=false;
  }
  answerBossDialog(giveUp){
    this.hideBossDialog();
    if(!this.currentRoom || !this.currentRoom.isBossStair) return;
    if(giveUp){
      // SIM: encerra o jogo (Game Over com mensagem especial)
      this.state='GAMEOVER';
      const title=document.getElementById('gameOverTitle');
      const stats=document.getElementById('gameOverStats');
      title.textContent='VOCÊ DESISTIU...';
      title.style.color='#ff8c42';
      stats.innerHTML=`Você desistiu diante do Boss da Escada na <b>Fase ${this.floor}</b>.<br>Ele permitiu que você partisse, mas a escuridão permanece.<br><br><span style="color:#8a8198;font-size:12px">Tente novamente e escolha NÃO para enfrentar o boss!</span>`;
      this.gameOverScreen.classList.add('active');
    } else {
      // NÃO: começa a boss fight
      this.currentRoom.bossFightStarted=true;
      this.currentRoom.bossDialogShown=true;
      this.showToast('✦ LUTA COMEÇOU! Destrua o Boss da Escada!', 2200);
      for(let k=0;k<20;k++) this.particles.push(new Particle(this.currentRoom.enemies[0].x, this.currentRoom.enemies[0].y, randRange(-1.8,1.8), randRange(-1.6,0.6), 420, '#ffd700', 2));
      // Shake inicial
      this.shake=100;
    }
  }

  showToast(msg, ms=2000){
    this.toast.textContent = msg;
    this.toast.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(()=> this.toast.classList.add('hidden'), ms);
  }

  checkRoomTransition(){
    if(this.transitionCooldown>0) return;
    if(!this.currentRoom || !this.player) return;
    // Defesa: se sala atual está vazia e fechada por bug (não party/boss), corrige para não travar
    if(!this.currentRoom.isCleared() && this.currentRoom.enemies.length===0 && !this.currentRoom.isPartyHorde && !this.currentRoom.isBossStair && !this.currentRoom.isMiniboss){
      console.warn('Corrigindo sala vazia fechada', this.currentRoom.gx, this.currentRoom.gy);
      // Força como limpa para não travar o jogador
      this.currentRoom.enemies = [];
    }
    if(!this.currentRoom.isCleared()) return;
    const pr=this.player.getRect();
    // Garante que player não está com NaN
    if(isNaN(this.player.x) || isNaN(this.player.y)){
      console.warn('Player NaN corrigido', this.player.x, this.player.y);
      this.player.x = CANVAS_W/2; this.player.y = CANVAS_H/2;
    }
    for(const d of this.currentRoom.getDoorRects()){
      if(rectCollide(pr.x, pr.y, pr.w, pr.h, d.x, d.y, d.w, d.h)){
        const dir=d.dir, key=(x,y)=>`${x},${y}`;
        let nx=this.currentRoom.gx, ny=this.currentRoom.gy;
        if(dir==='top') ny-=1; if(dir==='bottom') ny+=1; if(dir==='left') nx-=1; if(dir==='right') nx+=1;
        const next=this.roomLookup.get(key(nx,ny));
        if(!next){
          console.warn('Transição falhou: sala vizinha não encontrada', nx,ny);
          return;
        }
        // Validação: se próxima sala está vazia e fechada por bug, corrige antes de entrar
        if(!next.isCleared() && next.enemies.length===0 && !next.isPartyHorde && !next.isBossStair && !next.isMiniboss){
          console.warn('Corrigindo próxima sala vazia fechada', nx,ny);
          next.enemies = [];
        }
        this.currentRoom=next;
        const wasVisited=next.visited;
        next.visited=true;
        if(!wasVisited) this.roomsExplored++;
        const margin=48;
        if(dir==='top'){ this.player.x=CANVAS_W/2; this.player.y=CANVAS_H - WALL_THICK - margin; }
        if(dir==='bottom'){ this.player.x=CANVAS_W/2; this.player.y=WALL_THICK + margin; }
        if(dir==='left'){ this.player.x=CANVAS_W - WALL_THICK - margin; this.player.y=CANVAS_H/2; }
        if(dir==='right'){ this.player.x=WALL_THICK + margin; this.player.y=CANVAS_H/2; }
        // Garante que nova posição não está dentro de parede e não é NaN
        this.player.x = clamp(this.player.x, WALL_THICK + this.player.w/2 + 2, CANVAS_W - WALL_THICK - this.player.w/2 - 2);
        this.player.y = clamp(this.player.y, WALL_THICK + this.player.h/2 + 2, CANVAS_H - WALL_THICK - this.player.h/2 - 2);
        if(isNaN(this.player.x) || isNaN(this.player.y)){
          this.player.x = CANVAS_W/2; this.player.y = CANVAS_H/2;
        }
        this.player.vx=0; this.player.vy=0;
        if(this.player.isCharging) this.player.cancelCharge();
        if(this.player.isSwordCharging) this.player.cancelSwordCharge();
        // Limpa projéteis corpo a corpo e punhos entre salas para não levar para próxima sala
        this.bullets = this.bullets.filter(b=> b.owner!=='player' || dist(b.x,b.y,this.player.x,this.player.y)<120);
        this.lazerBeams = [];
        this.meleeSwings = [];
        this.fists = [];
        // Corrige bug da luva presa ao passar de sala atirando: limpa estado completo
        this.player.activeFists = [];
        this.player.activeFist = null;
        this.player.shootCooldown = Math.min(this.player.shootCooldown, 80);
        this.player.meleeAnim=0;
        // Corrige bastão preso ao passar de sala
        if(this.bastaoProjectiles && this.bastaoProjectiles.length){
          this.bastaoProjectiles = [];
        }
        if(this.player.characterId==='jg'){
          if(!this.player.hasBastao){
            this.player.hasBastao = true;
            this.player.bastaoProjectile = null;
          }
          if(this.player.isBastaoCharging) this.player.cancelBastaoCharge();
        }
        // Garante que estados de carga não fiquem presos
        if(this.player.isCharging) this.player.cancelCharge();
        if(this.player.isSwordCharging) this.player.cancelSwordCharge();
        // Oli - teleporta peças para perto do jogador ao trocar de sala (persistem no andar)
        if(this.oliPieces && this.oliPieces.length){
          for(const pc of this.oliPieces){
            pc.x = this.player.x + randRange(-32,32);
            pc.y = this.player.y + randRange(-32,32);
            pc.x = clamp(pc.x, WALL_THICK+pc.w/2, CANVAS_W-WALL_THICK-pc.w/2);
            pc.y = clamp(pc.y, WALL_THICK+pc.h/2, CANVAS_H-WALL_THICK-pc.h/2);
          }
        }
        if(this.oliPawns && this.oliPawns.length){
          for(const pw of this.oliPawns){
            pw.x = this.player.x + randRange(-24,24);
            pw.y = this.player.y + randRange(-24,24);
            pw.x = clamp(pw.x, WALL_THICK+pw.w/2, CANVAS_W-WALL_THICK-pw.w/2);
            pw.y = clamp(pw.y, WALL_THICK+pw.h/2, CANVAS_H-WALL_THICK-pw.h/2);
          }
        }
        this.transitionCooldown=400;
        for(let i=0;i<10;i++) this.particles.push(new Particle(this.player.x, this.player.y, randRange(-2,2), randRange(-2,2), 280, this.floor===3?'#00ff88': this.floor===2?'#ff8c42':'#7af', 3));
        this.showToast(`${wasVisited?'↩':'➤'} Sala ${nx},${ny} ${next.isCleared()?'• Limpa':'• Inimigos: '+next.enemies.length}`,1200);
        break;
      }
    }
  }

  checkExitPortal(){
    if(!this.currentRoom.exitPortal || !this.currentRoom.isExit) return;
    const p=this.currentRoom.exitPortal;
    // ativa portal só quando andar todo limpo
    p.active = this.isFloorCleared();
    if(!p.active) return;
    // colisão jogador-portal (central)
    const pr=this.player.getRect();
    if(rectCollide(pr.x, pr.y, pr.w, pr.h, p.x-p.w/2, p.y-p.h/2, p.w, p.h)){
      this.advanceFloor();
    }
  }

  // cria rastro de fogo ao longo do dash
  spawnDashFire(start, end){
    const steps = 7;
    for(let i=0;i<steps;i++){
      const t = i/(steps-1);
      const x = lerp(start.x, end.x, t) + randRange(-4,4);
      const y = lerp(start.y, end.y, t) + randRange(-4,4);
      let onWall=false;
      for(const w of this.currentRoom.walls) if(rectCollide(x-fireRadius, y-fireRadius, fireRadius*2, fireRadius*2, w.x,w.y,w.w,w.h)){ onWall=true; break; }
      if(onWall) continue;
      const fp = new FirePatch(x,y);
      this.currentRoom.fires.push(fp);
      for(let k=0;k<3;k++) this.particles.push(new Particle(x+randRange(-4,4), y+randRange(-4,4), randRange(-0.6,0.6), randRange(-1.4,-0.3), 340, '#ff6a00', 2));
    }
    for(let k=0;k<6;k++) this.particles.push(new Particle(end.x, end.y, randRange(-1.2,1.2), randRange(-1.2,0.2), 360, '#ffcc00', 3));
  }

  // encontra arma no chão próxima dentro do alcance de troca
  // Requisitos: só considera arma dentro de WEAPON_SWAP_RANGE, que não esteja equipada,
  // e que não cause duplicação no inventário (primária/secundária)
  // Modular por personagem: JG/Kinight bloqueiam troca na hora do swap (mantém hint para feedback)
  findNearbyWeapon(){
    if(!this.currentRoom || !this.currentRoom.items) return null;
    let best=null, bestDist=WEAPON_SWAP_RANGE+1;
    for(const it of this.currentRoom.items){
      if(!(it instanceof WeaponItem)) continue;
      const itName = it.weaponType.toLowerCase();
      const equippedName = this.player.weapon.name.toLowerCase();
      // não considera arma já equipada (mesmo nome) para evitar troca inútil/duplicação
      if(itName === equippedName) continue;
      // evita duplicação: não considerar arma que já existe no inventário (primária ou secundária)
      const primaryName = this.player.primaryWeapon?.name.toLowerCase();
      const secondaryName = this.player.secondaryWeapon?.name.toLowerCase();
      if(itName === primaryName || (secondaryName && itName === secondaryName)) continue;
      const d=dist(this.player.x, this.player.y, it.x, it.y);
      if(d < WEAPON_SWAP_RANGE && d < bestDist){
        best=it; bestDist=d;
      }
    }
    return best;
  }
  findNearbyUpgrade(){
    if(!this.currentRoom || !this.currentRoom.items) return null;
    let best=null, bestDist=WEAPON_SWAP_RANGE+1;
    for(const it of this.currentRoom.items){
      if(!(it instanceof UpgradeItem)) continue;
      if(it.spawnDelay>0) continue;
      const d=dist(this.player.x, this.player.y, it.x, it.y);
      if(d < WEAPON_SWAP_RANGE+12 && d < bestDist){
        best=it; bestDist=d;
      }
    }
    return best;
  }
  // Encontra item especial no chão próximo para troca/pega com E (prioritário)
  findNearbySpecialPickup(){
    if(this.player && this.player.characterId==='ash') return null; // Ash não pode usar itens especiais
    if(!this.currentRoom || !this.currentRoom.items) return null;
    let best=null, bestDist=SPECIAL_SWAP_RANGE+1;
    for(const it of this.currentRoom.items){
      if(!(it instanceof SpecialItemPickup)) continue;
      if(it.spawnDelay>0) continue; // evita pegar instantaneamente após spawn/troca (anti-duplicação)
      const d=dist(this.player.x, this.player.y, it.x, it.y);
      if(d < SPECIAL_SWAP_RANGE && d < bestDist){
        best=it; bestDist=d;
      }
    }
    return best;
  }
  // Tenta pegar ou trocar item especial via E. Retorna true se consumiu E para interação.
  // Validação centralizada (servidor simulado): checa distância, spawnDelay, atomicidade, evita duplicação.
  trySpecialSwapOrPickup(){
    if(this.player && this.player.characterId==='ash') return false; // Ash não usa especiais, E troca arma
    const nearby=this.findNearbySpecialPickup();
    if(!nearby) return false;
    if(nearby.spawnDelay>0) return false; // lock: outro jogador pegou ou recém dropado
    // Caso 1: sem equipado -> pega
    if(!this.player.equippedSpecial){
      const ok=nearby.tryPickupViaE(this.player);
      if(ok){
        // Remoção atômica: garante que não duplica e que dois jogadores não pegam mesmo item
        const idx=this.currentRoom.items.indexOf(nearby);
        if(idx!==-1) this.currentRoom.items.splice(idx,1);
        else return false; // já removido por outro (race)
        this.showToast(`★ ${this.player.equippedSpecial.name} equipado! [E]`, 2000);
        for(let k=0;k<12;k++) this.particles.push(new Particle(nearby.x, nearby.y, randRange(-1.6,1.6), randRange(-1.6,0.6), 320, this.player.equippedSpecial.color, 2));
        return true;
      }
      return false;
    } else {
      // Caso 2: com equipado -> troca instantânea
      const oldId=this.player.equippedSpecial.id;
      const newId=nearby.specialId;
      if(oldId===newId){
        this.showToast(`Já equipado: ${oldId.toUpperCase()}`, 1000);
        return true; // consome E mas não troca (evita ativar habilidade por engano)
      }
      const newSpecial=createSpecialItem(newId);
      if(!newSpecial) return false;
      // Equipa novo
      this.player.equipSpecial(newSpecial);
      // Reutiliza objeto do chão para old item (mesma posição, sem criar novo objeto -> evita duplicação/infinito e múltiplos itens)
      nearby.updateForSwap(oldId);
      this.showToast(`↔ ${oldId.toUpperCase()} → ${newId.toUpperCase()} [E]`, 1800);
      for(let k=0;k<10;k++) this.particles.push(new Particle(this.player.x,this.player.y, randRange(-1.5,1.5), randRange(-1.5,0.6), 300, newSpecial.color, 2));
      for(let k=0;k<8;k++) this.particles.push(new Particle(nearby.x,nearby.y, randRange(-1.2,1.2), randRange(-1.2,0.6), 280, '#ffffff', 2));
      return true;
    }
  }

  // tenta trocar arma equipada com arma no chão próxima
  // Requisitos: só troca se houver arma próxima válida, reutiliza objeto existente
  // (evita criação infinita), coloca arma equipada no chão (evita desaparecimento/duplicação)
  trySwapNearbyWeapon(){
    const nearby = this.findNearbyWeapon();
    if(!nearby) return false;
    const oldName = this.player.weapon.name; // ex: NORMAL, SHOTGUN
    const newName = nearby.weaponType; // ex: 'shotgun','raio','metralhadora','normal','carregada'
    // evita duplicação: se for mesmo tipo, não troca (já filtrado em findNearby, reforço)
    if(oldName.toLowerCase() === newName.toLowerCase()) return false;

    // cancela cargas se estiver carregando
    if(this.player.isCharging) this.player.cancelCharge();
    if(this.player.isSwordCharging) this.player.cancelSwordCharge();
    // limpa fist se trocando enquanto está ativo
    if(this.player.activeFist && !this.player.activeFist.dead){
      // força retorno imediato ao trocar de arma
      this.player.activeFist.returning=true;
    }
    // cria config da nova arma com melhorias vinculadas (reutiliza base + upgrades)
    let newWeapon=null;
    const nl=newName.toLowerCase();
    let wKey='NORMAL';
    if(nl==='shotgun') wKey='SHOTGUN';
    else if(nl==='raio') wKey='RAIO';
    else if(nl==='metralhadora' || nl==='minigun') wKey='METRALHADORA';
    else if(nl==='carregada') wKey='CARREGADA';
    else if(nl==='bazuca') wKey='BAZUCA';
    else if(nl==='espada') wKey='ESPADA';
    else if(nl==='luva' || nl==='luva_foguete') wKey='LUVA';
    else if(nl==='bastao') wKey='BASTAO';
    else if(nl==='motosserra') wKey='MOTOSSERRA';
    else if(nl==='raio_matematico') wKey='RAIO_MATEMATICO';
    else wKey='NORMAL';
    // Bloqueio modular por personagem já filtrado em findNearbyWeapon, mas reforça aqui
    if(this.player.characterId){
      const hook2=CHARACTER_HOOKS[this.player.characterId];
      let can2=true;
      if(hook2 && typeof hook2.canEquipWeapon==='function') can2=hook2.canEquipWeapon(this.player, wKey);
      else if(this.player.characterDef && this.player.characterDef.allowedWeapons) can2=this.player.characterDef.allowedWeapons.includes(wKey);
      if(!can2){
        this.showToast(`⛔ ${this.player.characterName} não pode equipar ${wKey}!`, 1300);
        return false;
      }
    }
    newWeapon = this.player.createWeaponWithUpgrades(wKey);
    // Ash: motosserra nunca pode ser desequipada, [E] troca arma, só pode ter +1 arma secundária
    if(this.player.characterId==='ash'){
      // Garante primary motosserra
      if(!this.player.primaryWeapon || this.player.primaryWeapon.name!=='MOTOSSERRA'){
        this.player.primaryWeapon = this.player.createWeaponWithUpgrades('MOTOSSERRA');
      }
      // Se não tem secundária, pega do chão como secundária (remove item do chão, motosserra fica)
      if(!this.player.secondaryWeapon){
        this.player.secondaryWeapon = newWeapon;
        // remove item do chão (não deixa motosserra no chão)
        const idx=this.currentRoom.items.indexOf(nearby);
        if(idx!==-1) this.currentRoom.items.splice(idx,1);
        // mantém motosserra equipada, não troca automaticamente (fica com motosserra)
        // feedback
        this.showToast(`+ ${newWeapon.name} coletada! Pressione [E] para trocar com Motosserra`, 1800);
        for(let k=0;k<10;k++) this.particles.push(new Particle(this.player.x, this.player.y, randRange(-1.5,1.5), randRange(-1.5,0.6), 300, '#ff3b30', 2));
        return true;
      } else {
        // Já tem secundária: troca secundária com chão, motosserra permanece intacta
        const oldSecName = this.player.secondaryWeapon.name;
        const wasUsingSecondary = (this.player.weapon === this.player.secondaryWeapon);
        const oldSecondary = this.player.secondaryWeapon;
        this.player.secondaryWeapon = newWeapon;
        if(wasUsingSecondary) this.player.weapon = this.player.secondaryWeapon;
        // coloca antiga secundária no chão
        nearby.weaponType = oldSecName.toLowerCase();
        nearby.type = oldSecName.toLowerCase();
        nearby.isRaio = oldSecName==='RAIO';
        nearby.isRayMatematico = oldSecName==='RAIO_MATEMATICO';
        nearby.isMini = oldSecName==='METRALHADORA';
        nearby.isNormal = oldSecName==='NORMAL';
        nearby.isCarregada = oldSecName==='CARREGADA';
        nearby.isBazuca = oldSecName==='BAZUCA';
        nearby.isShotgun = oldSecName==='SHOTGUN';
        nearby.isEspada = oldSecName==='ESPADA';
        nearby.isLuva = oldSecName==='LUVA';
        nearby.isBastao = oldSecName==='BASTAO';
        nearby.isMotosserra = oldSecName==='MOTOSSERRA';
        if(nearby.isRaio) nearby.w = nearby.h = ITEM_SIZE_RAIO;
        else if(nearby.isRayMatematico) nearby.w = nearby.h = 22;
        else if(nearby.isMini) nearby.w = nearby.h = 22;
        else if(nearby.isNormal) nearby.w = nearby.h = 20;
        else if(nearby.isCarregada) nearby.w = nearby.h = 20;
        else if(nearby.isBazuca) nearby.w = nearby.h = 24;
        else if(nearby.isEspada) nearby.w = nearby.h = 20;
        else if(nearby.isLuva) nearby.w = nearby.h = 22;
        else if(nearby.isBastao) nearby.w = nearby.h = ITEM_SIZE_BASTAO;
        else if(nearby.isMotosserra) nearby.w = nearby.h = ITEM_SIZE_MOTOSSERRA;
        else nearby.w = nearby.h = ITEM_SIZE_SHOTGUN;
        nearby.spawnDelay = 320;
        // preserva heat reset
        if(newWeapon.name==='METRALHADORA'){ this.player.miniHeat=0; this.player.isOverheated=false; this.player.overheatTimer=0; }
        this.showToast(`↔ ${oldSecName} → ${newWeapon.name} (secundária) [E] troca`, 1500);
        for(let k=0;k<9;k++) this.particles.push(new Particle(this.player.x, this.player.y, randRange(-1.5,1.5), randRange(-1.5,0.6), 300, '#ff3b30', 2));
        for(let k=0;k<7;k++) this.particles.push(new Particle(nearby.x, nearby.y, randRange(-1.2,1.2), randRange(-1.2,0.6), 280, '#ffffff', 2));
        return true;
      }
    }
    // guarda config antiga para colocar no chão (apenas referência, não cria novo objeto)
    let oldWeaponConfig=null;
    if(oldName==='SHOTGUN') oldWeaponConfig={...WEAPON_SHOTGUN};
    else if(oldName==='RAIO') oldWeaponConfig={...WEAPON_RAIO};
    else if(oldName==='RAIO_MATEMATICO') oldWeaponConfig={...WEAPON_RAIO_MATEMATICO};
    else if(oldName==='METRALHADORA') oldWeaponConfig={...WEAPON_METRALHADORA};
    else if(oldName==='CARREGADA') oldWeaponConfig={...WEAPON_CARREGADA};
    else if(oldName==='BAZUCA') oldWeaponConfig={...WEAPON_BAZUCA};
    else if(oldName==='ESPADA') oldWeaponConfig={...WEAPON_ESPADA};
    else if(oldName==='LUVA') oldWeaponConfig={...WEAPON_LUVA};
    else if(oldName==='BASTAO') oldWeaponConfig={...WEAPON_BASTAO};
    else if(oldName==='MOTOSSERRA') oldWeaponConfig={...WEAPON_MOTOSSERRA};
    else oldWeaponConfig={...WEAPON_NORMAL};

    // se a nova arma era ligada a doubleShot, preserva flag? DoubleShot é da primária, não da arma secundária
    // atualiza slot do jogador que estava equipado
    if(this.player.weapon === this.player.primaryWeapon){
      this.player.primaryWeapon = newWeapon;
      this.player.weapon = this.player.primaryWeapon;
    } else if(this.player.weapon === this.player.secondaryWeapon){
      this.player.secondaryWeapon = newWeapon;
      this.player.weapon = this.player.secondaryWeapon;
    } else {
      // fallback: se arma equipada não é nem primária nem secundária (deve ser primária)
      this.player.weapon = newWeapon;
      this.player.primaryWeapon = newWeapon;
    }
    // preserva heat reset para metralhadora
    if(newWeapon.name==='METRALHADORA'){
      this.player.miniHeat = 0; this.player.isOverheated=false; this.player.overheatTimer=0;
    } else {
      // ao desequipar metralhadora, reseta heat para não acumular
      this.player.miniHeat = 0; this.player.isOverheated=false; this.player.overheatTimer=0;
    }
    // velocidade será recalculada no próximo Player.update (penalidade não acumula)

    // coloca arma antiga no chão no mesmo lugar da arma próxima (evita desaparecimento/duplicação)
    // reutiliza o mesmo objeto 'nearby' (evita criação infinita), apenas troca seu tipo
    nearby.weaponType = oldName.toLowerCase();
    nearby.type = oldName.toLowerCase(); // mantém tipo consistente para checagens futuras
    // atualiza todas as flags para refletir a nova arma no chão (evita estado inconsistente)
    nearby.isRaio = oldName==='RAIO';
    nearby.isRayMatematico = oldName==='RAIO_MATEMATICO';
    nearby.isMini = oldName==='METRALHADORA';
    nearby.isNormal = oldName==='NORMAL';
    nearby.isCarregada = oldName==='CARREGADA';
    nearby.isBazuca = oldName==='BAZUCA';
    nearby.isShotgun = oldName==='SHOTGUN';
    nearby.isEspada = oldName==='ESPADA';
    nearby.isLuva = oldName==='LUVA';
    nearby.isBastao = oldName==='BASTAO';
    nearby.isMotosserra = oldName==='MOTOSSERRA';
    // atualiza tamanho conforme nova arma (variável fácil de ajustar)
    if(nearby.isRaio) nearby.w = nearby.h = ITEM_SIZE_RAIO;
    else if(nearby.isRayMatematico) nearby.w = nearby.h = 22;
    else if(nearby.isMini) nearby.w = nearby.h = 22;
    else if(nearby.isNormal) nearby.w = nearby.h = 20;
    else if(nearby.isCarregada) nearby.w = nearby.h = 20;
    else if(nearby.isBazuca) nearby.w = nearby.h = 24;
    else if(nearby.isEspada) nearby.w = nearby.h = 20;
    else if(nearby.isLuva) nearby.w = nearby.h = 22;
    else if(nearby.isBastao) nearby.w = nearby.h = ITEM_SIZE_BASTAO;
    else if(nearby.isMotosserra) nearby.w = nearby.h = ITEM_SIZE_MOTOSSERRA;
    else nearby.w = nearby.h = ITEM_SIZE_SHOTGUN;
    nearby.spawnDelay = 320; // evita coleta automática/troca imediata indevida (maior que antes)

    // partículas e toast
    this.showToast(`↔ ${oldName} → ${newWeapon.name} [Q]`, 1300);
    const col = newWeapon.name==='RAIO'?'#00e5ff': newWeapon.name==='RAIO_MATEMATICO'?'#7af2ff': newWeapon.name==='METRALHADORA'?'#ff3b30': newWeapon.name==='CARREGADA'?'#a78bfa': newWeapon.name==='SHOTGUN'?'#ff8c42': newWeapon.name==='ESPADA'?'#e8e8e8': newWeapon.name==='LUVA'?'#ff3b30': newWeapon.name==='MOTOSSERRA'?'#ff3b30': newWeapon.name==='BASTAO'?'#facc15':'#ffeb3b';
    for(let k=0;k<10;k++) this.particles.push(new Particle(this.player.x, this.player.y, randRange(-1.9,1.9), randRange(-1.9,0.7), 300, col, 2));
    for(let k=0;k<8;k++) this.particles.push(new Particle(nearby.x, nearby.y, randRange(-1.5,1.5), randRange(-1.5,0.8), 320, '#ffffff', 2));
    return true;
  }

  update(dt){
    if(this.state==='PAUSED') return; // congelado quando pausado (ver itens, reset)
    if(this.state!=='PLAYING') return;
    if(this.bossDialogActive) return; // pausa total enquanto diálogo do boss está aberto
    if(!this.currentRoom || !this.player){
      console.warn('Game.update: currentRoom/player ausente');
      return;
    }
    if(isNaN(this.player.x) || isNaN(this.player.y)){
      console.warn('Player NaN corrigido em update', this.player.x, this.player.y);
      this.player.x = CANVAS_W/2; this.player.y = CANVAS_H/2;
    }
    if(this.transitionCooldown>0) this.transitionCooldown-=dt;
    try{
    if(this.shake>0) this.shake-=dt;
    // ===== BOSS FASE 5 - Trigger diálogo ao entrar na sala da escada =====
    if(this.currentRoom && this.currentRoom.isBossStair && !this.currentRoom.bossDialogShown && !this.currentRoom.bossStairDefeated){
      // Só mostra se o boss ainda existe e a luta não começou
      const bossExists=this.currentRoom.enemies.some(e=> e.type==='stair_boss' && !e.dead);
      if(bossExists){
        // Espera um pouco para player ver arena antes de perguntar (300ms)
        this._bossDialogDelay=(this._bossDialogDelay||0)+dt;
        if(this._bossDialogDelay>320){
          this.currentRoom.bossDialogShown=true;
          this.showBossDialog();
          this._bossDialogDelay=0;
          return;
        }
      }
    } else {
      this._bossDialogDelay=0;
    }

    // ===== SISTEMA ITENS ESPECIAIS (E) - PRIORIDADE: TROCA/PEGA > ATIVAR HABILIDADE =====
    // - Se há item especial no chão próximo, E faz troca/pega instantânea (requisito).
    // - Senão, E ativa habilidade do equipado (se não estiver em cooldown).
    // - Um único timer no SpecialItem.update(dt) controla cooldown; sem setInterval.
    // - consumeJustPressed + validação de distância/spawnDelay evita spam e duplicação.
    // - Validação centralizada em trySpecialSwapOrPickup (simula validação servidor).
    if(this.input.consumeJustPressed('e')){
      // Ash: E troca arma (motosserra ↔ secundária), não usa especiais
      if(this.player.characterId==='ash'){
        if(this.player.secondaryWeapon){
          const ok=this.player.swapWeapon();
          if(ok){
            this.showToast(`↔ MOTOSSERRA ↔ ${this.player.weapon.name} [E]`, 1300);
            for(let k=0;k<9;k++) this.particles.push(new Particle(this.player.x, this.player.y, randRange(-1.4,1.4), randRange(-1.4,0.6), 280, '#ff3b30', 2));
          }
        } else {
          this.showToast('Ash: sem segunda arma! Pegue uma com [Q] perto do chão', 1300);
        }
      } else {
        const didInteraction=this.trySpecialSwapOrPickup();
        if(!didInteraction){
          // Não havia item para interagir (ou falhou por já equipado mesmo), tenta ativar habilidade
          // Mas se havia item próximo e falhou por already-equipped, já consumiu E e não ativa (prioriza interação)
          const nearbySpecial=this.findNearbySpecialPickup();
          if(!nearbySpecial){
            const res = this.player.tryUseSpecial(this);
            if(res.ok){
              const sp = this.player.equippedSpecial;
              // Para Flecha Stand, mostra habilidade sorteada dinamicamente
              let abilityName='';
              if(sp.id==='flecha_stand' && sp.currentAbility) abilityName=` → ${sp.currentAbility.name}`;
              this.showToast(`✦ ${sp.name}${abilityName} ativada!`, 1600);
            } else {
              if(res.reason==='no_item'){
                this.showToast('Sem item especial equipado [E]', 1100);
              } else if(res.reason==='cooldown'){
                const secs = Math.ceil(res.remaining/1000);
                const spName=this.player.equippedSpecial.id==='flecha_stand' && this.player.equippedSpecial.currentAbility ? `${this.player.equippedSpecial.name} (${this.player.equippedSpecial.currentAbility.name})` : this.player.equippedSpecial.name;
                this.showToast(`${spName} em recarga: ${secs}s`, 1000);
              } else if(res.reason==='active'){
                this.showToast(`${this.player.equippedSpecial.name} já está ativo!`, 1000);
              }
            }
          } else {
            // Havia item próximo mas didInteraction falso por already-equipped já tratado dentro de trySpecialSwapOrPickup
            // Se for outro caso (ex: spawnDelay), não faz nada para evitar ativar por engano
          }
        }
      }
    }

    // troca de armas Q: só permite troca quando há arma próxima válida (requisito)
    // - Se não houver arma próxima, não faz nada (evita troca indevida)
    // - Reutiliza objeto existente (evita criação infinita)
    // - Mostra hint "Pressione Q para trocar" quando houver arma próxima (tratado abaixo)
    if(this.input.consumeJustPressed('q')){
      const swapped = this.trySwapNearbyWeapon();
      if(!swapped){
        // Não há arma próxima válida -> não permite troca (requisito)
        // Mantido sem toggle automático para evitar comportamento inesperado
        // Se quiser manter toggle entre primária/secundária quando longe, descomente abaixo:
        // if(this.player.hasSecondary()){ this.player.swapWeapon(); ... }
      }
    }
    // hint "Pressione E/Q para trocar" - prioriza especial (E) sobre upgrade e arma Q. Ash usa E para trocar arma e não usa especiais.
    const nearbySpecialHint = this.findNearbySpecialPickup();
    const nearbyUpgradeHint = this.findNearbyUpgrade();
    const nearbyForHint = this.findNearbyWeapon();
    if(this.swapHint){
      if(this.player.characterId==='ash'){
        if(nearbyForHint){
          if(!this.player.secondaryWeapon){
            this.swapHint.textContent = `Pressione Q para pegar ${nearbyForHint.weaponType.toUpperCase()} como secundária (Motosserra fixa)`;
          } else {
            this.swapHint.textContent = `Pressione Q para trocar secundária ${this.player.secondaryWeapon.name} → ${nearbyForHint.weaponType.toUpperCase()} (Motosserra fixa)`;
          }
          this.swapHint.style.borderColor = 'rgba(255,59,48,0.45)';
          this.swapHint.style.color = '#ff6b35';
          this.swapHint.style.background = 'rgba(0,0,0,0.84)';
          this.swapHint.classList.remove('hidden');
        } else if(nearbyUpgradeHint){
          const r = nearbyUpgradeHint.rarity;
          const def = nearbyUpgradeHint.def;
          const curLv = this.player.upgradeLevels.get(def.id) || 0;
          const nextLv = Math.min(curLv+1, def.maxLevel||1);
          const maxLv = def.maxLevel || 1;
          const compat = def.compatible || [def.weapon];
          const compatStr = compat.includes('ALL') ? 'TODAS' : compat.join(',');
          const lvStr = maxLv>1 ? ` Nv${nextLv}/${maxLv}` : '';
          this.swapHint.textContent = `★ ${r.name} ${def.name}${lvStr} [${compatStr}] - ${def.desc}`;
          this.swapHint.style.borderColor = r.border;
          this.swapHint.style.color = r.color;
          this.swapHint.style.background = 'rgba(0,0,0,0.84)';
          this.swapHint.classList.remove('hidden');
        } else if(this.player.secondaryWeapon){
          this.swapHint.textContent = `Pressione [E] para trocar MOTOSSERRA ↔ ${this.player.secondaryWeapon.name}`;
          this.swapHint.style.borderColor = 'rgba(255,59,48,0.35)';
          this.swapHint.style.color = '#ff8c42';
          this.swapHint.style.background = 'rgba(0,0,0,0.84)';
          this.swapHint.classList.remove('hidden');
        } else {
          this.swapHint.textContent = `Ash: Motosserra fixa • Pegue +1 arma no chão com [Q] • Sem especiais`;
          this.swapHint.style.borderColor = 'rgba(255,59,48,0.22)';
          this.swapHint.style.color = '#ff6b35';
          this.swapHint.style.background = 'rgba(0,0,0,0.72)';
          this.swapHint.classList.remove('hidden');
        }
      } else if(nearbySpecialHint){
        const equipped = this.player.equippedSpecial ? this.player.equippedSpecial.name : 'VAZIO';
        const action = this.player.equippedSpecial ? `Trocar ${equipped} → ${nearbySpecialHint.specialName}` : `Pegar ${nearbySpecialHint.specialName}`;
        this.swapHint.textContent = `${action} [E]`;
        this.swapHint.style.borderColor = nearbySpecialHint.specialColor;
        this.swapHint.style.color = nearbySpecialHint.specialColor;
        this.swapHint.style.background = 'rgba(0,0,0,0.84)';
        this.swapHint.classList.remove('hidden');
      } else if(nearbyUpgradeHint){
        const r = nearbyUpgradeHint.rarity;
        const def = nearbyUpgradeHint.def;
        const curLv = this.player.upgradeLevels.get(def.id) || 0;
        const nextLv = Math.min(curLv+1, def.maxLevel||1);
        const maxLv = def.maxLevel || 1;
        const compat = def.compatible || [def.weapon];
        const compatStr = compat.includes('ALL') ? 'TODAS' : compat.join(',');
        const lvStr = maxLv>1 ? ` Nv${nextLv}/${maxLv}` : '';
        this.swapHint.textContent = `★ ${r.name} ${def.name}${lvStr} [${compatStr}] - ${def.desc}`;
        this.swapHint.style.borderColor = r.border;
        this.swapHint.style.color = r.color;
        this.swapHint.style.background = 'rgba(0,0,0,0.84)';
        this.swapHint.classList.remove('hidden');
      } else if(nearbyForHint){
        this.swapHint.textContent = `Pressione Q para trocar ${this.player.weapon.name} → ${nearbyForHint.weaponType.toUpperCase()}`;
        this.swapHint.style.borderColor = 'rgba(255,204,0,0.28)';
        this.swapHint.style.color = '#ffeb3b';
        this.swapHint.style.background = 'rgba(0,0,0,0.84)';
        this.swapHint.classList.remove('hidden');
      } else {
        this.swapHint.classList.add('hidden');
      }
    }

    const walls=this.currentRoom.walls;
    this.player.update(dt, this.input, walls);
    // Atualiza cooldown/duração do item especial equipado (ÚNICO timer confiável, sem múltiplos setTimeout)
    if(this.player.equippedSpecial){
      this.player.equippedSpecial.update(dt, this.player, this);
    }
    // Atualiza aliados Stand (Flecha Stand - Invocar Aliado) - duração e IA própria
    for(let i=this.allies.length-1;i>=0;i--){
      const al=this.allies[i];
      const alive=al.update(dt, this.currentRoom.enemies, walls, this.particles);
      if(!alive || al.dead){
        // efeito desaparecimento
        for(let k=0;k<10;k++) this.particles.push(new Particle(al.x,al.y, randRange(-1.2,1.2), randRange(-1.2,0.4), 280, '#a78bfa', 2));
        this.allies.splice(i,1);
      }
    }
    // === GATO ANTIVÍRUS AZUL (passiva normal) - companheiro persistente ===
    // Passiva: ao coletar GatoAntivirusPickup, hasGatoAntivirus=true e gato fica para sempre (não é especial, não usa E)
    if(this.player.hasGatoAntivirus){
      if(!this.gatoAntivirus || this.gatoAntivirus.length===0){
        // invoca gato perto do jogador (sem colidir parede)
        let sx=this.player.x + randRange(-28,28), sy=this.player.y + randRange(-28,28), tries=0;
        const wallsG=this.currentRoom?this.currentRoom.walls:[];
        while(tries<12){
          let onWall=false;
          for(const w of wallsG) if(rectCollide(sx-13,sy-13,26,26,w.x,w.y,w.w,w.h)) {onWall=true; break;}
          if(!onWall) break;
          sx=this.player.x + randRange(-40,40); sy=this.player.y + randRange(-40,40); tries++;
        }
        sx=clamp(sx, WALL_THICK+20, CANVAS_W-WALL_THICK-20);
        sy=clamp(sy, WALL_THICK+20, CANVAS_H-WALL_THICK-20);
        const cat=new GatoAntivirus(sx,sy,this.player);
        if(!this.gatoAntivirus) this.gatoAntivirus=[];
        this.gatoAntivirus.push(cat);
        for(let k=0;k<16;k++){ const ang=Math.random()*Math.PI*2; this.particles.push(new Particle(sx,sy, Math.cos(ang)*randRange(1.4,3.4), Math.sin(ang)*randRange(1.4,3.4), 420, '#3b82f6', 2.2)); }
        for(let k=0;k<6;k++) this.particles.push(new Particle(sx,sy, randRange(-1,1), randRange(-1,0.6), 300, '#ffffff', 1.6));
        if(this.showToast) this.showToast('🐱 GATO ANTIVÍRUS passivo ativo! Caça automática.', 1700);
      }
    } else {
      // Se perdeu a passiva (ex: novo jogo) mas gato existe -> remove com efeito
      if(this.gatoAntivirus && this.gatoAntivirus.length>0){
        for(const cat of this.gatoAntivirus){
          for(let k=0;k<10;k++) this.particles.push(new Particle(cat.x,cat.y, randRange(-1.4,1.4), randRange(-1.2,0.6), 280, '#3b82f6', 1.8));
        }
        this.gatoAntivirus=[];
      }
    }
    // Atualiza gatos ativos (IA: detectar -> ir -> atacar+stun -> voltar -> 2s sem atacar)
    for(let i=(this.gatoAntivirus||[]).length-1;i>=0;i--){
      const cat=this.gatoAntivirus[i];
      cat.player = this.player; // mantém referência atualizada
      cat.update(dt, this.currentRoom.enemies, walls, this.particles);
    }
    // Oli - peças de xadrez (Torre/Bispo/Rainha/Rei) - cada uma com mecânica única, reconhece Oli como dono
    for(let i=this.oliPieces.length-1;i>=0;i--){
      const piece=this.oliPieces[i];
      let alive=true;
      if(piece.type==='torre') alive=piece.update(dt, this.currentRoom.enemies, walls, this.particles);
      else if(piece.type==='bispo') alive=piece.update(dt, this.currentRoom.enemies, walls, this.particles);
      else if(piece.type==='rainha') alive=piece.update(dt, this.currentRoom.enemies, walls, this.particles, this.bullets, this.player);
      else if(piece.type==='rei') alive=piece.update(dt, this.currentRoom.enemies, walls, this.particles, this.bullets, this.player);
      else alive=piece.update(dt, this.currentRoom.enemies, walls, this.particles);
      // colisão inimigo -> peça toma dano (peças têm vida própria)
      for(const e of this.currentRoom.enemies){
        if(e.dead) continue;
        if(piece.dead) break;
        if(rectCollide(piece.x-piece.w/2, piece.y-piece.h/2, piece.w, piece.h, e.x-e.w/2, e.y-e.h/2, e.w, e.h)){
          // inimigo não ataca Oli, mas ataca a peça (dano de contato)
          const dmg = e.collisionDamage || 1;
          piece.takeDamage(dmg*0.5);
          // empurra peça levemente
          const ang=Math.atan2(piece.y-e.y, piece.x-e.x);
          piece.x+=Math.cos(ang)*4; piece.y+=Math.sin(ang)*4;
          piece.hitFlash=100;
          if(piece.dead) break;
        }
      }
      if(!alive || piece.dead){
        for(let k=0;k<12;k++) this.particles.push(new Particle(piece.x,piece.y, randRange(-1.4,1.4), randRange(-1.2,0.6), 260, '#a78bfa',1.8));
        // explosão peça específica
        this.currentRoom.explosions.push({x:piece.x,y:piece.y,radius:10,life:280,max:280,isChessPiece:true, pieceType:piece.type});
        this.oliPieces.splice(i,1);
      }
    }
    // Oli - peões do Rei
    for(let i=this.oliPawns.length-1;i>=0;i--){
      const pawn=this.oliPawns[i];
      const alive=pawn.update(dt, this.currentRoom.enemies, walls, this.particles);
      // peão colide com inimigo já causa dano dentro do próprio update, mas também precisa verificar se inimigo mata peão
      for(const e of this.currentRoom.enemies){
        if(e.dead || pawn.dead) continue;
        if(rectCollide(pawn.x-pawn.w/2, pawn.y-pawn.h/2, pawn.w, pawn.h, e.x-e.w/2, e.y-e.h/2, e.w, e.h)){
          pawn.takeDamage((e.collisionDamage||1)*0.6);
        }
      }
      if(!alive || pawn.dead){
        for(let k=0;k<8;k++) this.particles.push(new Particle(pawn.x,pawn.y, randRange(-1,1), randRange(-1,0.5), 200, '#d1d5db',1.4));
        this.oliPawns.splice(i,1);
      }
    }
    // se dash com rastro de fogo, gera fogo no caminho real percorrido
    if(this.player.didDashThisFrame && this.player.hasFlameTrail){
      const start = this.player.dashStartPos || {x:this.player.x, y:this.player.y};
      const end = {x:this.player.x + this.player.vx*2.2, y:this.player.y + this.player.vy*2.2};
      // clamp para não sair da sala
      end.x = clamp(end.x, WALL_THICK+12, CANVAS_W-WALL_THICK-12);
      end.y = clamp(end.y, WALL_THICK+12, CANVAS_H-WALL_THICK-12);
      this.spawnDashFire(start, end);
      this.shake = Math.max(this.shake, 70);
    }

    const shootVec=this.input.getShootVector();
    const w = this.player.weapon;
    const isRayMatematico = w && w.isRayMatematico;
    const isCarregada = w && w.isCharged && !isRayMatematico;
    const isSword = w && w.isSword;
    if(isRayMatematico){
      // ===== DEV - LAZER CODIFICADO (Brimstone) - segurar para carregar 100% + Sobremesa mini =====
      // Mecânica Brimstone Isaac: retângulo reto com ondulações leves, dano moderado (2.2), perfurante.
      if(shootVec){
        if(!this.player.isRayMatematicoCharging){
          if(this.player.canShoot()){
            this.player.startRayMatematicoCharge(shootVec);
          }
        } else {
          const prog = this.player.updateRayMatematicoCharge(dt, shootVec);
          // Efeito visual de carregamento (energia ciano crescente - Brimstone carregando)
          if(Math.random() < 0.22 + prog*0.28){
            const col = prog > 0.90 ? '#ffffff' : prog > 0.60 ? '#b8fffb' : '#7af2ff';
            this.particles.push(new Particle(this.player.x + shootVec.x*11 + randRange(-2,2), this.player.y + shootVec.y*11 + randRange(-2,2), randRange(-0.5,0.5), randRange(-0.9,-0.1), 190, col, prog > 0.75 ? 2.6 : 1.6));
          }
          // Sobremesa: a cada 10% dispara mini raio se upgrade ativo (mantido como mini projétil laranja)
          if(this.player.hasSobremesa()){
            const thresholds = [10,20,30,40,50,60,70,80,90,100];
            const pct = prog*100;
            for(const th of thresholds){
              if(pct >= th && !this.player.rayMatematicoFiredThresholds.has(th)){
                this.player.rayMatematicoFiredThresholds.add(th);
                const mini = this.player.createRayMatematicoMini(shootVec);
                if(mini){
                  this.bullets.push(mini);
                  for(let k=0;k<4;k++) this.particles.push(new Particle(this.player.x + shootVec.x*10, this.player.y + shootVec.y*10, shootVec.x*randRange(1.2,2.4)+randRange(-0.5,0.5), shootVec.y*randRange(1.2,2.4)+randRange(-0.5,0.5), 160, '#ffd8a8', 1.9));
                  for(let k=0;k<2;k++) this.particles.push(new Particle(mini.x, mini.y, randRange(-0.8,0.8), randRange(-0.8,0.3), 140, '#ffffff', 1.3));
                  try{ playWeaponSound('RAIO', false); }catch(e){}
                  if(th===100) this.shake = Math.max(this.shake, 18);
                  else this.shake = Math.max(this.shake, 10);
                }
              }
            }
          }
          if(prog >= 0.995 && Math.random() < 0.30){
            this.particles.push(new Particle(this.player.x, this.player.y-8, randRange(-0.7,0.7), -1.0, 170, '#ffffff', 1.6));
          }
          if(prog >= 0.99 && Math.random() < 0.18) this.shake = Math.max(this.shake, 14);
        }
      } else {
        // Soltou botão
        if(this.player.isRayMatematicoCharging){
          const progBefore = this.player.getRayMatematicoProgress();
          const newBeams = this.player.releaseRayMatematicoCharge();
          if(newBeams.length > 0){
            // Disparo Brimstone - feixe retangular ondulado
            for(const b of newBeams) this.lazerBeams.push(b);
            const dir = newBeams[0] ? {x: newBeams[0].dirX, y: newBeams[0].dirY} : this.player.lastDir;
            for(let i=0;i<7;i++) this.particles.push(new Particle(this.player.x + dir.x*14, this.player.y + dir.y*14, dir.x*randRange(1.8,3.6)+randRange(-0.9,0.9), dir.y*randRange(1.8,3.6)+randRange(-0.9,0.9), 220, '#b8fffb', 2.6));
            for(let i=0;i<9;i++) this.particles.push(new Particle(this.player.x, this.player.y, randRange(-2,2), randRange(-1.8,0.6), 300, '#ffffff', 2.2));
            // explosão retangular curta no disparo
            this.currentRoom.explosions.push({x:this.player.x + dir.x*18, y:this.player.y + dir.y*18, radius:10, life:220, max:220, isLazerMuzzle:true});
            this.shake = 92;
            this.showToast(`▓ LAZER CODIFICADO! Dano ${w.damage.toFixed(1)} • Retângulo Brimstone`, 1500);
            try{ playWeaponSound('RAIO', true); }catch(e){}
          } else {
            if(progBefore > 0.15){
              this.showToast(`◯ Carga ${Math.round(progBefore*100)}% • Segure até 100% para disparar o LAZER`, 1100);
              for(let k=0;k<3;k++) this.particles.push(new Particle(this.player.x, this.player.y, randRange(-0.9,0.9), randRange(-0.9,0.4), 180, 'rgba(184,255,251,0.7)', 1.4));
            }
          }
        }
      }
    } else if(isCarregada){
      // Mecânica segurar para carregar (CARREGADA)
      if(shootVec){
        if(!this.player.isCharging){
          if(this.player.canShoot()){
            this.player.startCharge(shootVec);
          }
        } else {
          this.player.updateCharge(dt, shootVec);
          const prog = this.player.getChargeProgress();
          if(Math.random() < 0.18 + prog*0.25){
            const col = prog > 0.85 ? '#ffffff' : prog > 0.5 ? '#e9d5ff' : '#a78bfa';
            this.particles.push(new Particle(this.player.x + shootVec.x*10 + randRange(-2,2), this.player.y + shootVec.y*10 + randRange(-2,2), randRange(-0.4,0.4), randRange(-0.8,0.2), 180, col, prog > 0.7 ? 2.5 : 1.5));
          }
          if(prog > 0.88 && Math.random() < 0.22) this.shake = Math.max(this.shake, 22);
        }
      } else {
        if(this.player.isCharging){
          const progBefore = this.player.getChargeProgress();
          const dmgBefore = this.player.getChargeDamage();
          const newBullets = this.player.releaseCharge();
          for(const b of newBullets) this.bullets.push(b);
          if(newBullets.length > 0){
            const intensity = Math.floor(3 + progBefore*4);
            const col = progBefore > 0.85 ? '#e9d5ff' : '#a78bfa';
            const dir = newBullets[0] ? {x: newBullets[0].dirX, y: newBullets[0].dirY} : shootVec || this.player.lastDir;
            for(let i=0;i<intensity;i++) this.particles.push(new Particle(this.player.x + dir.x*14, this.player.y + dir.y*14, dir.x*randRange(1.5,3.2)+randRange(-0.9,0.9), dir.y*randRange(1.5,3.2)+randRange(-0.9,0.9), 170, col, 2.2));
            if(progBefore >= 0.99){
              for(let i=0;i<6;i++) this.particles.push(new Particle(this.player.x, this.player.y, randRange(-2,2), randRange(-2,0.5), 260, '#ffffff', 2));
            }
            this.shake = 55 + progBefore*45;
            if(progBefore >= 0.99) this.showToast(`★ TIRO CARREGADO MÁXIMO! Dano ${dmgBefore.toFixed(1)}`, 1200);
          }
        }
      }
    } else if(isSword){
      // ESPADA: segurar para golpe pesado com preparo
      if(shootVec){
        if(!this.player.isSwordCharging){
          if(this.player.canShoot()){
            this.player.startSwordCharge(shootVec);
          }
        } else {
          this.player.updateSwordCharge(dt, shootVec);
          const prog = this.player.getSwordChargeProgress();
          // partículas de preparo: brilho metálico crescente
          if(Math.random() < 0.20 + prog*0.22){
            const col = prog > 0.85 ? '#ffffff' : prog > 0.5 ? '#e8e8e8' : '#a0a0a0';
            this.particles.push(new Particle(this.player.x + shootVec.x*12 + randRange(-1.5,1.5), this.player.y + shootVec.y*12 + randRange(-1.5,1.5), randRange(-0.5,0.5), randRange(-0.7,0.1), 150, col, prog>0.7?2:1.4));
          }
          // Partículas extra Guardião Ágil (aura ciana) enquanto carrega
          if(this.player.weapon && this.player.weapon._swordGuardian){
            if(Math.random() < 0.32 + prog*0.20){
              const ang=Math.random()*Math.PI*2, r=14+prog*6;
              const px=this.player.x + Math.cos(ang)*r, py=this.player.y + Math.sin(ang)*r + (Math.random()<0.5? -4:0);
              this.particles.push(new Particle(px, py, randRange(-0.4,0.4), randRange(-0.9,-0.2), 220, 'rgba(126,200,255,0.95)', 1.8));
            }
            if(prog>0.65 && Math.random()<0.18){
              this.particles.push(new Particle(this.player.x, this.player.y, randRange(-0.7,0.7), -0.9, 180, '#cfe8ff', 1.3));
            }
            if(prog>0.88 && Math.random()<0.14) this.shake=Math.max(this.shake, 10);
          }
          if(prog>0.92 && Math.random()<0.18) this.shake=Math.max(this.shake,14);
          // indicador de pesado pronto
          if(prog>=1 && Math.random()<0.28){
            this.particles.push(new Particle(this.player.x, this.player.y-8, randRange(-0.6,0.6), -1.2, 160, '#ffffff', 1.5));
          }
        }
      } else {
        if(this.player.isSwordCharging){
          const progBefore=this.player.getSwordChargeProgress();
          const swing=this.player.releaseSwordCharge();
          if(swing){
            this.meleeSwings.push(swing);
            const isHeavy=swing.isHeavy;
            const col=isHeavy?'#ffffff':'#e8e8e8';
            const intensity=isHeavy?6:3;
            const dir={x: swing.dirX, y: swing.dirY};
            for(let i=0;i<intensity;i++) this.particles.push(new Particle(this.player.x+dir.x*16, this.player.y+dir.y*16, dir.x*randRange(1.2,2.8)+randRange(-0.8,0.8), dir.y*randRange(1.2,2.8)+randRange(-0.8,0.8), 150, col, 2.1));
            if(isHeavy){
              for(let k=0;k<8;k++) this.particles.push(new Particle(this.player.x, this.player.y, randRange(-1.4,1.4), randRange(-1.4,0.4), 220, '#ffffff', 2));
              this.shake=88;
              this.showToast(`⚔️ GOLPE PESADO! ${swing.damage.toFixed(1)} dano`, 1100);
            } else {
              this.shake=48;
            }
            // ===== Corte de Vento - pesado sempre lança onda base, upgrade amplia =====
            if(isHeavy){
              const hasWaveUpgrade = !!(this.player.weapon && this.player.weapon._swordWave);
              const waveRange = hasWaveUpgrade ? (this.player.weapon._swordWaveRange ?? UPGRADE_VALUES.ESPADA_INCOMUM_WAVE_RANGE) : (this.player.weapon.baseWaveRange ?? WEAPON_ESPADA.baseWaveRange);
              const waveSpeed = hasWaveUpgrade ? (this.player.weapon._swordWaveSpeed ?? UPGRADE_VALUES.ESPADA_INCOMUM_WAVE_SPEED) : (this.player.weapon.baseWaveSpeed ?? WEAPON_ESPADA.baseWaveSpeed);
              const waveFactor = hasWaveUpgrade ? (this.player.weapon._swordWaveFactor ?? UPGRADE_VALUES.ESPADA_INCOMUM_WAVE_DMG_FACTOR) : (this.player.weapon.baseWaveFactor ?? WEAPON_ESPADA.baseWaveFactor);
              const waveSize = hasWaveUpgrade ? (this.player.weapon._swordWaveSize ?? UPGRADE_VALUES.ESPADA_INCOMUM_WAVE_SIZE) : (this.player.weapon.baseWaveSize ?? WEAPON_ESPADA.baseWaveSize);
              const waveDmg = swing.damage * waveFactor;
              const dirN = normalize(dir.x, dir.y);
              const sx = this.player.x + dirN.x*(this.player.w/2+14);
              const sy = this.player.y + dirN.y*(this.player.h/2+10);
              const wave = new Bullet(sx, sy, dirN.x, dirN.y, 'player', {
                speed: waveSpeed,
                damage: waveDmg,
                range: waveRange,
                size: waveSize,
                color: '#d8ecff',
                glow: 'rgba(140,190,255,0.42)',
                pierce: true,
                pierceCount: 3,
                isSwordWave: true
              });
              this.bullets.push(wave);
              for(let k=0;k<12;k++) this.particles.push(new Particle(sx + dirN.x*6, sy + dirN.y*6, dirN.x*randRange(1.6,3.2)+randRange(-0.7,0.7), dirN.y*randRange(1.6,3.2)+randRange(-0.7,0.7), 220, '#aaddff', 2));
              for(let k=0;k<6;k++) this.particles.push(new Particle(this.player.x, this.player.y, randRange(-1.6,1.6), randRange(-1.6,0.6), 260, '#ffffff', 1.9));
              this.shake = Math.max(this.shake, 96);
              this.showToast(`💨 CORTE DE VENTO! ${waveDmg.toFixed(1)} dano à distância`, 1300);
            }
          }
        }
      }
    } else if(this.player.characterId==='jg'){
      // JG - Bastão: segurar para carregar arremesso giratório, soltar lança e retorna
      // Sem duplicação: apenas um bastão pode estar em voo; hasBastao controla velocidade e ataque
      if(shootVec){
        if(!this.player.isBastaoCharging){
          if(this.player.canShoot() && this.player.hasBastao){
            this.player.startBastaoCharge(shootVec);
          } else if(!this.player.hasBastao){
            // sem bastão, não pode atacar - mostra hint sutil a cada 1s
            if(Math.random()<0.02) this.showToast('🏏 Bastão retornando...', 700);
          }
        } else {
          this.player.updateBastaoCharge(dt, shootVec);
          const prog=this.player.getBastaoChargeProgress();
          if(Math.random()<0.22+prog*0.22){
            const col=prog>0.85?'#ffffff':prog>0.5?'#fde68a':'#facc15';
            this.particles.push(new Particle(this.player.x+shootVec.x*12+randRange(-1.5,1.5), this.player.y+shootVec.y*12+randRange(-1.5,1.5), randRange(-0.5,0.5), randRange(-0.7,0.1), 150, col, prog>0.7?2:1.4));
          }
          if(prog>=0.99 && Math.random()<0.18) this.shake=Math.max(this.shake,12);
          if(prog>=1 && Math.random()<0.28) this.particles.push(new Particle(this.player.x,this.player.y-8, randRange(-0.6,0.6), -1.2, 160, '#ffffff',1.5));
        }
      } else {
        if(this.player.isBastaoCharging){
          const progBefore=this.player.getBastaoChargeProgress();
          const result=this.player.releaseBastaoCharge();
          if(result){
            if(result instanceof BastaoProjectile){
              // Arremesso - vai para array de bastões (gerenciado separado para não duplicar com bullets)
              if(!this.bastaoProjectiles) this.bastaoProjectiles=[];
              this.bastaoProjectiles.push(result);
              this.player.bastaoProjectile=result;
              // sincroniza com Game.bullets? Não, mantemos separado mas trata colisão igual
              for(let i=0;i<8;i++) this.particles.push(new Particle(this.player.x+ result.dirX*6, this.player.y+result.dirY*6, result.dirX*randRange(1.4,3)+randRange(-0.6,0.6), result.dirY*randRange(1.4,3)+randRange(-0.6,0.6), 220, '#facc15',2));
              for(let k=0;k<6;k++) this.particles.push(new Particle(this.player.x,this.player.y, randRange(-1.4,1.4), randRange(-1.4,0.4), 220, '#ffffff',2));
              this.shake=88;
              this.showToast(`🏏 BASTÃO LANÇADO! Gira e retorna (${result.damage.toFixed(1)} dano)`, 1100);
            } else if(result instanceof MeleeSwing){
              // Tap rápido virou melee
              this.meleeSwings.push(result);
              const dir={x: result.dirX, y: result.dirY};
              for(let i=0;i<3;i++) this.particles.push(new Particle(this.player.x+dir.x*16, this.player.y+dir.y*16, dir.x*randRange(1.2,2.8)+randRange(-0.8,0.8), dir.y*randRange(1.2,2.8)+randRange(-0.8,0.8), 150, '#facc15', 2.1));
              this.shake=48;
            }
          }
        }
      }
    } else if(w && w.isMotosserra){
      // MOTOSSERRA: área RETA contínua na frente enquanto segura - dano em ticks, vibração, recuo
      if(shootVec){
        if(!this.player.motosserraActive){
          this.player.motosserraActive = true;
          this.player.motosserraTick = 0;
          this.player.motosserraDir = {x: shootVec.x, y: shootVec.y};
          this.player.lastDir.x = shootVec.x; this.player.lastDir.y = shootVec.y;
          if(shootVec.x!==0) this.player.facing = shootVec.x>0?1:-1;
          // inicia zona
          if(!this.motosserraZone) this.motosserraZone = {active:false, x:0,y:0,w:0,h:0,cx:0,cy:0, dir:{x:0,y:0}, angle:0};
          this.motosserraZone.active = true;
        }
        // atualiza direção enquanto segura (segue mira)
        this.player.motosserraDir.x = shootVec.x;
        this.player.motosserraDir.y = shootVec.y;
        this.player.lastDir.x = shootVec.x; this.player.lastDir.y = shootVec.y;
        if(shootVec.x!==0) this.player.facing = shootVec.x>0?1:-1;
        this.player.motosserraIdleTimer = 0;
        // partículas serra girando no vazio
        if(Math.random()<0.52){
          const dir = this.player.motosserraDir;
          const w2 = this.player.weapon.areaW || MOTOSSERRA_AREA_W;
          const h2 = this.player.weapon.areaH || MOTOSSERRA_AREA_H;
          const off = this.player.weapon.offset || MOTOSSERRA_OFFSET;
          const cx = this.player.x + dir.x * off;
          const cy = this.player.y + dir.y * off;
          this.particles.push(new Particle(cx+randRange(-w2/2,w2/2)*0.6, cy+randRange(-h2/2,h2/2)*0.6, randRange(-0.9,0.9), randRange(-0.9,0.5), 160, '#ff3b30', 1.8));
          if(Math.random()<0.28) this.particles.push(new Particle(this.player.x+dir.x*14, this.player.y+dir.y*14, randRange(-0.7,0.7), randRange(-0.9,-0.2), 140, '#ff8c42', 1.4));
        }
        if(Math.random()<0.20) this.shake = Math.max(this.shake, 14);
      } else {
        // soltou botão -> para imediatamente
        if(this.player.motosserraActive){
          this.player.motosserraActive = false;
          this.player.motosserraTick = 0;
          if(this.motosserraZone) this.motosserraZone.active = false;
        }
      }
      if(!shootVec && this.player.motosserraActive){
        this.player.motosserraActive = false;
        if(this.motosserraZone) this.motosserraZone.active = false;
      }
    } else {
      // Outras armas: NORMAL, SHOTGUN, RAIO, METRALHADORA, BAZUCA, LUVA
      if(shootVec && this.player.canShoot()){
        const newObjs=this.player.shoot(shootVec);
        for(const obj of newObjs){
          if(obj instanceof MeleeSwing) this.meleeSwings.push(obj);
          else if(obj instanceof RocketFist){ this.fists.push(obj); this.player.activeFist=obj; }
          else this.bullets.push(obj);
        }
        if(newObjs.length>0){
          const first=newObjs[0];
          const isMelee = first instanceof MeleeSwing;
          const isFist = first instanceof RocketFist;
          let color='#ffeb3b', shakeVal=60, count=3;
          if(w.name==='SHOTGUN'){ color='#ff8c42'; shakeVal=85; count=5; }
          else if(w.name==='BAZUCA'){ color='#ff3b30'; shakeVal=120; count=6; }
          else if(w.name==='RAIO'){ color='#00e5ff'; shakeVal=70; }          else if(w.name==='LUVA'){ color='#ff3b30'; shakeVal=72; count=4; }
          else if(w.name==='ESPADA'){ color='#e8e8e8'; shakeVal=50; count=3; }          else if(isMelee){ color=w.color||'#fff'; shakeVal=55; }
          else if(isFist){ color=w.color||'#ff3b30'; shakeVal=70; }
          if(!isMelee){
            for(let i=0;i<count;i++) this.particles.push(new Particle(this.player.x + shootVec.x*14, this.player.y+shootVec.y*14, shootVec.x*randRange(1,2.2)+randRange(-0.8,0.8), shootVec.y*randRange(1,2.2)+randRange(-0.8,0.8), 140, color, 2));
          } else {
            // melee já tem partículas no swing, adiciona faísca curta
            for(let i=0;i<2;i++) this.particles.push(new Particle(this.player.x + shootVec.x*16, this.player.y+shootVec.y*16, randRange(-0.8,0.8), randRange(-0.8,0.8), 120, color, 1.8));
          }
          this.shake = shakeVal;
          if(w.name==='BAZUCA'){
            for(let k=0;k<8;k++) this.particles.push(new Particle(this.player.x+shootVec.x*10, this.player.y+shootVec.y*10, shootVec.x*randRange(0.5,1.5)+randRange(-0.6,0.6), shootVec.y*randRange(0.5,1.5)+randRange(-0.6,0.6), 220, 'rgba(255,80,30,0.9)', 2));
          }        }
      }
    }

    // MOTOSSERRA ÁREA: atualiza zona retangular na frente e aplica dano contínuo em ticks (segurar = área ativa)
    if(this.player.weapon && this.player.weapon.isMotosserra && this.player.motosserraActive){
      if(!this.motosserraZone) this.motosserraZone = {active:false, x:0,y:0,w:0,h:0,cx:0,cy:0, dir:{x:0,y:0}, angle:0};
      const w2 = this.player.weapon;
      const tickInt = w2.tickInterval || MOTOSSERRA_TICK_INTERVAL;
      this.player.motosserraTick = (this.player.motosserraTick||0) - dt;
      const dir = normalize(this.player.motosserraDir.x, this.player.motosserraDir.y);
      const areaW = w2.areaW || MOTOSSERRA_AREA_W;
      const areaH = w2.areaH || MOTOSSERRA_AREA_H;
      const off = w2.offset || MOTOSSERRA_OFFSET;
      const cx = this.player.x + dir.x * off;
      const cy = this.player.y + dir.y * off;
      this.motosserraZone.x = cx - areaW/2;
      this.motosserraZone.y = cy - areaH/2;
      this.motosserraZone.w = areaW;
      this.motosserraZone.h = areaH;
      this.motosserraZone.cx = cx;
      this.motosserraZone.cy = cy;
      this.motosserraZone.dir = dir;
      this.motosserraZone.angle = Math.atan2(dir.y, dir.x);
      this.motosserraZone.active = true;
      // vibração e recuo personagem enquanto segura
      this.player.motosserraVibrate = Math.sin(this.player.animTime*0.72)*MOTOSSERRA_VIBRATE_AMP;
      // aplica dano em ticks
      if(this.player.motosserraTick <= 0){
        this.player.motosserraTick = tickInt;
        let hitCount = 0;
        for(const e of this.currentRoom.enemies){
          if(e.dead) continue;
          if(e.type==='hacker' && !e.battleStarted) continue;
          if(e.type==='stair_boss'){
            let hitStair=false;
            for(const hand of e.getHands()){
              if(hand.dead || hand.invulnerable) continue;
              if(rectCollide(this.motosserraZone.x, this.motosserraZone.y, this.motosserraZone.w, this.motosserraZone.h, hand.x-hand.w/2, hand.y-hand.h/2, hand.w, hand.h)){
                const isCenterH = Math.abs(hand.x - cx) < areaW*0.22 && Math.abs(hand.y - cy) < areaH*0.28;
                const dmg = isCenterH ? w2.damage*1.28 : w2.damage;
                const diedH=hand.takeDamage(dmg);
                hand.hitFlash=isCenterH?160:140; hitStair=true; hitCount++;
                for(let k=0;k<4;k++) this.particles.push(new Particle(hand.x, hand.y, randRange(-1.4,1.4), randRange(-1.4,0.6), 180, isCenterH?'#ff8c42':'#ff3b30', 1.8));
                if(isCenterH) for(let k=0;k<2;k++) this.particles.push(new Particle(hand.x, hand.y, randRange(-0.8,0.8), randRange(-0.8,0.4), 180, '#ffff00', 1.4));
                if(this.player.motosserraCharge!==undefined) this.player.addMotosserraCharge(isCenterH? MOTOSSERRA_CHARGE_PER_HIT*0.68 : MOTOSSERRA_CHARGE_PER_HIT*0.55);
                if(diedH) for(let k=0;k<8;k++){ const ang=Math.random()*Math.PI*2; this.particles.push(new Particle(hand.x, hand.y, Math.cos(ang)*randRange(1.2,3), Math.sin(ang)*randRange(1.2,3), 260, '#ff3b30', 2)); }
              }
            }
            if(rectCollide(this.motosserraZone.x, this.motosserraZone.y, this.motosserraZone.w, this.motosserraZone.h, e.x-e.w/2, e.y-e.h/2, e.w, e.h) && !e.isHeadInvulnerable()){
              const isCenterB = Math.abs(e.x - cx) < areaW*0.22 && Math.abs(e.y - cy) < areaH*0.28;
              const dmgB = isCenterB ? w2.damage*1.28 : w2.damage;
              const died=e.takeDamage(dmgB);
              e.hitFlash=isCenterB?180:160; hitCount++; hitStair=true;
              for(let k=0;k<5;k++) this.particles.push(new Particle(e.x, e.y, randRange(-1.4,1.4), randRange(-1.4,0.6), 180, isCenterB?'#ffd700':'#ff8c42', 2));
              if(isCenterB) this.shake=Math.max(this.shake, 20);
              if(this.player.motosserraCharge!==undefined) this.player.addMotosserraCharge(isCenterB? MOTOSSERRA_CHARGE_PER_HIT*1.15 : MOTOSSERRA_CHARGE_PER_HIT);
            }
            if(hitStair){ e.x+=dir.x*1.4; e.y+=dir.y*1.4; }
            continue;
          }
          if(rectCollide(this.motosserraZone.x, this.motosserraZone.y, this.motosserraZone.w, this.motosserraZone.h, e.x-e.w/2, e.y-e.h/2, e.w, e.h)){
            const isCenter = Math.abs(e.x - cx) < areaW*0.24 && Math.abs(e.y - cy) < areaH*0.30;
            const dmg = isCenter ? w2.damage * 1.28 : w2.damage;
            const died=e.takeDamage(dmg);
            e.hitFlash=isCenter?180:140; hitCount++;
            if(isCenter){
              for(let k=0;k<3;k++) this.particles.push(new Particle(e.x, e.y, randRange(-1,1), randRange(-1,0.4), 220, '#ffff00', 1.8));
              this.shake=Math.max(this.shake, 26);
            }
            if(!died){
              e.motosserraBleed=(e.motosserraBleed||0)+2;
              e.motosserraBleedTimer=280;
              e.motosserraBleedDmg= isCenter?0.85:0.7;
            }
            for(let k=0;k<5;k++) this.particles.push(new Particle(e.x, e.y, randRange(-1.6,1.6), randRange(-1.4,0.6), 180, isCenter?'#ff8c42':'#ff3b30', 1.8));
            for(let k=0;k<2;k++) this.particles.push(new Particle(e.x, e.y, randRange(-1,1), randRange(-1,0.4), 180, '#1a1a1a', 1.4));
            this.shake=Math.max(this.shake,isCenter?22:18);
            if(this.player.motosserraCharge!==undefined) this.player.addMotosserraCharge(isCenter? MOTOSSERRA_CHARGE_PER_HIT*1.22 : MOTOSSERRA_CHARGE_PER_HIT);
            const ang=Math.atan2(e.y - cy, e.x - cx);
            e.x+=Math.cos(ang)*4; e.y+=Math.sin(ang)*4;
            e.x=clamp(e.x, WALL_THICK+e.w/2, CANVAS_W-WALL_THICK-e.w/2);
            e.y=clamp(e.y, WALL_THICK+e.h/2, CANVAS_H-WALL_THICK-e.h/2);
            if(died) for(let k=0;k<10;k++){ const ang2=Math.random()*Math.PI*2; this.particles.push(new Particle(e.x, e.y, Math.cos(ang2)*randRange(1.2,3), Math.sin(ang2)*randRange(1.2,3), 260, '#ff3b30', 2)); }
          }
        }
        if(hitCount===0){
          if(this.player.motosserraCharge!==undefined){
            this.player.motosserraCharge=Math.min(this.player.motosserraChargeMax, this.player.motosserraCharge + MOTOSSERRA_CHARGE_PER_TICK_EMPTY * dt / tickInt);
          }
        } else {
          this.shake=Math.max(this.shake,24);
          try{ playWeaponSound('MOTOSSERRA', false); }catch(_){}
        }
      }
      // recuo leve personagem enquanto segura
      this.player.x += dir.x * 0.16;
      this.player.y += dir.y * 0.16;
      this.player.x = clamp(this.player.x, WALL_THICK+this.player.w/2, CANVAS_W-WALL_THICK-this.player.w/2);
      this.player.y = clamp(this.player.y, WALL_THICK+this.player.h/2, CANVAS_H-WALL_THICK-this.player.h/2);
    } else {
      if(this.motosserraZone) this.motosserraZone.active=false;
      if(this.player) { this.player.motosserraActive=false; this.player.motosserraTick=0; this.player.motosserraVibrate=0; }
    }

    // bullets update (player + enemy)
    const enemyNewBullets=[];
    // Nota: enemy bullets serão adicionados via Room.update -> enemyBulletsOut, mas também precisamos tratar bullets já existentes como enemy
    for(const b of this.bullets) b.update(dt, walls);

    // enemy bullets collision com player
    for(let i=this.bullets.length-1;i>=0;i--){
      const b=this.bullets[i];
      if(b.owner==='enemy' && !b.dead){
        if(circleRectCollide(b.x,b.y,b.size, this.player.x-this.player.w/2, this.player.y-this.player.h/2, this.player.w, this.player.h)){
          b.dead=true;
          if(!this.player.isInvulnerable()){
            if(this.player.takeDamage(1)){
              for(let k=0;k<9;k++) this.particles.push(new Particle(this.player.x,this.player.y, randRange(-2.8,2.8), randRange(-3,1), 320, '#c084fc', 3));
              this.shake=110;
            }
          }
        }
      }
    }

    // remove dead bullets e partículas impacto
    for(let i=this.bullets.length-1;i>=0;i--){
      if(this.bullets[i].dead){
        const b=this.bullets[i];
        if(b.traveled < b.range -5){
          const col = b.owner==='enemy' ? '#c084fc' : (b.isArrow ? '#4ade80' : '#aaa');
          for(let k=0;k<4;k++) this.particles.push(new Particle(b.x,b.y, randRange(-1.8,1.8), randRange(-1.8,1.8), 180, col, 2));
        }
        this.bullets.splice(i,1);
      }
    }

    // ===== LAZER CODIFICADO - FEIXE BRIMSTONE UPDATE E COLISÃO =====
    for(let i=this.lazerBeams.length-1;i>=0;i--){
      const beam=this.lazerBeams[i];
      beam.update(dt, walls, this.player);
      // colisão retangular ondulada com inimigos (perfura, dano moderado)
      for(const e of this.currentRoom.enemies){
        if(e.dead) continue;
        if(e.type==='hacker' && !e.battleStarted) continue;
        if(e.type==='stair_boss'){
          let hitBoss=false;
          for(const hand of e.getHands()){
            if(hand.dead || hand.invulnerable) continue;
            if(beam.hits(hand)){
              const died=hand.takeDamage(beam.damage);
              beam.registerHit(hand);
              hitBoss=true;
              for(let k=0;k<6;k++) this.particles.push(new Particle(hand.x, hand.y, randRange(-1.6,1.6), randRange(-1.4,0.6), 220, '#b8fffb', 2.2));
              for(let k=0;k<3;k++) this.particles.push(new Particle(hand.x, hand.y, randRange(-1,1), randRange(-1,0.5), 180, '#ffffff', 1.6));
              hand.hitFlash=170;
              const ang=Math.atan2(hand.y - beam.y, hand.x - beam.x);
              hand.x+=Math.cos(ang)*7; hand.y+=Math.sin(ang)*7;
              if(died){
                for(let k=0;k<10;k++){ const ang2=Math.random()*Math.PI*2; this.particles.push(new Particle(hand.x, hand.y, Math.cos(ang2)*randRange(1.2,3.2), Math.sin(ang2)*randRange(1.2,3.2), 300, '#7af2ff', 2)); }
                if(e.leftHand.dead && e.rightHand.dead){
                  for(let k=0;k<14;k++){ const ang2=Math.random()*Math.PI*2; this.particles.push(new Particle(e.x,e.y, Math.cos(ang2)*randRange(1.4,3.2), Math.sin(ang2)*randRange(1.2,3.2), 360, '#ffd700', 2)); }
                }
              }
            }
          }
          if(hitBoss) continue;
          if(!e.isHeadInvulnerable() && beam.hits(e)){
            const died=e.takeDamage(beam.damage);
            beam.registerHit(e);
            for(let k=0;k<6;k++) this.particles.push(new Particle(e.x, e.y, randRange(-1.6,1.6), randRange(-1.4,0.6), 220, '#ffd700', 2.2));
            e.hitFlash=170;
            const ang=Math.atan2(e.y - beam.y, e.x - beam.x);
            e.x+=Math.cos(ang)*7; e.y+=Math.sin(ang)*7;
            if(died){
              for(let k=0;k<14;k++){ const ang2=Math.random()*Math.PI*2; this.particles.push(new Particle(e.x, e.y, Math.cos(ang2)*randRange(1.4,3.6), Math.sin(ang2)*randRange(1.2,3.6), 360, '#ffd700', 2.5)); }
            }
          } else if(e.isHeadInvulnerable() && beam.hits(e)){
            // cabeça bloqueada: faísca cinza
            for(let k=0;k<3;k++) this.particles.push(new Particle(beam.x + beam.dirX*22, beam.y + beam.dirY*22, randRange(-0.8,0.8), randRange(-0.8,0.8), 140, 'rgba(180,180,190,0.9)', 1.2));
          }
          continue;
        }
        if(beam.hits(e)){
          const died=e.takeDamage(beam.damage);
          beam.registerHit(e);
          for(let k=0;k<5;k++) this.particles.push(new Particle(e.x, e.y, randRange(-1.6,1.6), randRange(-1.4,0.6), 220, '#7af2ff', 2));
          for(let k=0;k<3;k++) this.particles.push(new Particle(e.x, e.y, randRange(-1,1), randRange(-1,0.4), 180, '#ffffff', 1.6));
          e.hitFlash=160;
          const ang=Math.atan2(e.y - beam.y, e.x - beam.x);
          e.x+=Math.cos(ang)*6; e.y+=Math.sin(ang)*6;
          e.x=clamp(e.x, WALL_THICK+e.w/2, CANVAS_W-WALL_THICK-e.w/2);
          e.y=clamp(e.y, WALL_THICK+e.h/2, CANVAS_H-WALL_THICK-e.h/2);
          if(died){
            for(let k=0;k<10;k++){ const ang2=Math.random()*Math.PI*2; this.particles.push(new Particle(e.x, e.y, Math.cos(ang2)*randRange(1.2,3), Math.sin(ang2)*randRange(1.2,3), 300, '#7af2ff', 2)); }
          }
        }
      }
      if(beam.dead) this.lazerBeams.splice(i,1);
    }

    // melee swings update (segue jogador) e fist update
    for(let i=this.meleeSwings.length-1;i>=0;i--){
      const m=this.meleeSwings[i];
      m.x=this.player.x; m.y=this.player.y;
      if(!m.update(dt)) this.meleeSwings.splice(i,1);
    }
    for(let i=this.fists.length-1;i>=0;i--){
      const f=this.fists[i];
      if(!f.update(dt, this.player, walls, this.particles)){
        if(this.player.activeFist===f) this.player.activeFist=null;
        if(this.player.activeFists){
          const idx=this.player.activeFists.indexOf(f);
          if(idx!==-1) this.player.activeFists.splice(idx,1);
          if(this.player.activeFists.length===0) this.player.activeFist=null;
          else this.player.activeFist=this.player.activeFists[0];
        }
        this.fists.splice(i,1);
      }
    }
    // colisão melee vs inimigos (cone) - inclui boss mãos/cabeça
    for(const m of this.meleeSwings){
      for(const e of this.currentRoom.enemies){
        if(e.dead) continue;
        // Boss: verifica mãos e cabeça separadamente
        if(e.type==='stair_boss'){
          let handled=false;
          for(const hand of e.getHands()){
            if(hand.dead || hand.invulnerable) continue;
            if(!m.hits(hand)) continue;
            if(m.hasHit.has(hand) && m.pierce===0) continue;
            if(m.hasHit.has(hand)) continue;
            const diedH=hand.takeDamage(m.damage);
            if(m.stun>0 && hand.stunTimer!==undefined) hand.stunTimer = Math.max(hand.stunTimer||0, m.stun);
            m.registerHit(hand);
            const colH='#ffd700';
            for(let k=0;k<6;k++) this.particles.push(new Particle(hand.x, hand.y, randRange(-1.6,1.6), randRange(-1.4,0.6), 180, colH, 2));
            if(m.isHeavy){
              const ang=Math.atan2(hand.y - m.y, hand.x - m.x);
              hand.x+=Math.cos(ang)*12; hand.y+=Math.sin(ang)*12;
            } else {
              const ang=Math.atan2(hand.y - m.y, hand.x - m.x);
              hand.x+=Math.cos(ang)*6; hand.y+=Math.sin(ang)*6;
            }
            if(diedH){
              for(let k=0;k<10;k++){ const ang=Math.random()*Math.PI*2; this.particles.push(new Particle(hand.x,hand.y, Math.cos(ang)*randRange(1.4,3), Math.sin(ang)*randRange(1.2,3), 280, '#ffd700', 2)); }
              if(e.leftHand.dead && e.rightHand.dead){
                for(let k=0;k<14;k++){ const ang=Math.random()*Math.PI*2; this.particles.push(new Particle(e.x,e.y, Math.cos(ang)*randRange(1.4,3.2), Math.sin(ang)*randRange(1.2,3.2), 320, '#ffd700', 2)); }
              }
            }
            handled=true;
            // martelo shock também atinge mãos? já tratado via hasHit
            if(m.weaponName==='MARTELO' && m.shockRadius>0 && !m._shockDone){
              m._shockDone=true;
              this.currentRoom.explosions.push({x:m.x, y:m.y, radius:14, life:300, max:300, isHammerShock:true});
              for(let k=0;k<14;k++){ const ang=Math.random()*Math.PI*2; this.particles.push(new Particle(m.x,m.y, Math.cos(ang)*randRange(1.2,3.2), Math.sin(ang)*randRange(1.2,3.2), 260, '#8a6d3b', 2)); }
              this.shake=Math.max(this.shake,62);
            }
            // não proccessa cabeça no mesmo frame se já acertou mão (evita duplo hit pierce=0)
            if(m.pierce===0) break;
          }
          if(handled && m.pierce===0) continue;
          // tenta cabeça se vulnerável
          if(!e.isHeadInvulnerable() && m.hits(e)){
            if(m.hasHit.has(e) && m.pierce===0) continue;
            const died=e.takeDamage(m.damage);
            if(m.stun>0 && e.stunTimer!==undefined) e.stunTimer=Math.max(e.stunTimer||0, m.stun);
            m.registerHit(e);
            const col='#ffd700';
            for(let k=0;k<6;k++) this.particles.push(new Particle(e.x, e.y, randRange(-1.6,1.6), randRange(-1.4,0.6), 180, col, 2));
            if(m.isHeavy){
              const ang=Math.atan2(e.y - m.y, e.x - m.x);
              e.x+=Math.cos(ang)*10; e.y+=Math.sin(ang)*10;
            } else {
              const ang=Math.atan2(e.y - m.y, e.x - m.x);
              e.x+=Math.cos(ang)*6; e.y+=Math.sin(ang)*6;
            }
            if(died){
              for(let k=0;k<12;k++){ const ang=Math.random()*Math.PI*2; this.particles.push(new Particle(e.x,e.y, Math.cos(ang)*randRange(1.4,3.8), Math.sin(ang)*randRange(1.2,3), 300, col, 2.5)); }
            }
            if(m.weaponName==='MARTELO' && m.shockRadius>0 && !m._shockDone){
              m._shockDone=true;
              this.currentRoom.explosions.push({x:m.x, y:m.y, radius:14, life:300, max:300, isHammerShock:true});
              this.shake=Math.max(this.shake,62);
            }
          } else if(e.isHeadInvulnerable() && m.hits(e)){
            // cabeça bloqueada: faísca cinza (fase2)
            for(let k=0;k<3;k++) this.particles.push(new Particle(m.x + m.dirX*18, m.y + m.dirY*18, randRange(-0.8,0.8), randRange(-0.8,0.8), 120, 'rgba(180,180,190,0.9)', 1.2));
          }
          continue;
        }
        if(!m.hits(e)) continue;
        if(m.hasHit.has(e) && m.pierce===0) continue;
        if(m.pierce>0 && m.pierceCount>=m.pierce) continue;
        const died=e.takeDamage(m.damage);
        if(m.stun>0 && e.stunTimer!==undefined) e.stunTimer = Math.max(e.stunTimer||0, m.stun);
        m.registerHit(e);
        let col = '#fff';
        if(m.weaponName==='ESPADA') col = m.isHeavy?'#ffffff':'#e8e8e8';
        else if(m.weaponName==='MOTOSSERRA') col = m.isHeavy?'#ff8c42':'#ff3b30';
        else if(m.weaponName==='BASTAO') col = '#facc15';
        for(let k=0;k<6;k++) this.particles.push(new Particle(e.x, e.y, randRange(-1.6,1.6), randRange(-1.4,0.6), 180, col, 2));
        if(m.weaponName==='MOTOSSERRA'){
          // MELHORADO: serragem intensa + sangramento + trepidação visceral
          for(let k=0;k<8;k++) this.particles.push(new Particle(e.x, e.y, randRange(-2.2,2.2), randRange(-2.0,-0.2), 220, '#ff2a1a', 2.8));
          for(let k=0;k<4;k++) this.particles.push(new Particle(e.x, e.y, randRange(-1.6,1.6), randRange(-1.8,-0.4), 180, '#ff8c42', 2.2));
          for(let k=0;k<3;k++) this.particles.push(new Particle(e.x, e.y, randRange(-1.2,1.2), randRange(-1.2,0.6), 200, '#1a1a1a', 2));
          this.shake = Math.max(this.shake, 58);
          e.hitFlash = 180;
          // Sangramento: 3 ticks de 0.9 dano (total +2.7) se não morreu
          if(!died){
            e.motosserraBleed = (e.motosserraBleed||0) + 3;
            e.motosserraBleedTimer = 280;
            e.motosserraBleedDmg = 0.9;
            // faísca sangramento
            for(let k=0;k<3;k++) this.particles.push(new Particle(e.x, e.y, randRange(-1,1), randRange(-1,0.4), 260, '#8b0000', 1.8));
          }
          if(this.player && this.player.weapon && this.player.weapon.hasPochita){
            // Pochita: explosão lateral serragem dourada + dano em área
            for(let k=0;k<8;k++) this.particles.push(new Particle(e.x+randRange(-12,12), e.y+randRange(-12,12), randRange(-1.4,1.4), randRange(-1.4,0.6), 240, '#ffcc66', 2.8));
            for(let k=0;k<5;k++) this.particles.push(new Particle(e.x, e.y, randRange(-1.6,1.6), randRange(-1.6,0.6), 200, '#ffb347', 2));
            this.shake = Math.max(this.shake, 72);
            // Dano em área lateral pochita (42px)
            for(const other of this.currentRoom.enemies){
              if(other===e || other.dead) continue;
              if(dist(e.x,e.y, other.x, other.y) < 42){
                const died2 = other.takeDamage(m.damage*0.42);
                other.hitFlash = 140;
                for(let k=0;k<4;k++) this.particles.push(new Particle(other.x, other.y, randRange(-1.2,1.2), randRange(-1.2,0.6), 200, '#ffcc66', 1.8));
                if(died2){
                  for(let k=0;k<8;k++){ const ang=Math.random()*Math.PI*2; this.particles.push(new Particle(other.x, other.y, Math.cos(ang)*randRange(1.2,3), Math.sin(ang)*randRange(1.2,3), 280, '#ff8c42', 2)); }
                }
              }
            }
            // Pochita também carrega extra
            if(this.player && typeof this.player.addMotosserraCharge==='function') this.player.addMotosserraCharge(6);
          }
          // Barra motosserra: atacar muito enche e cura 1 coração
          if(this.player && typeof this.player.addMotosserraCharge==='function'){
            this.player.addMotosserraCharge(MOTOSSERRA_CHARGE_PER_HIT);
          }
          try{ playWeaponSound('MOTOSSERRA', m.isHeavy); }catch(_){}
        }
        if(m.isHeavy){
          const ang=Math.atan2(e.y - m.y, e.x - m.x);
          e.x+=Math.cos(ang)*14; e.y+=Math.sin(ang)*14;
          for(let k=0;k<7;k++) this.particles.push(new Particle(e.x,e.y, randRange(-1.8,1.8), randRange(-1.4,0.6), 200, '#ffffff', 2));
        } else {
          const ang=Math.atan2(e.y - m.y, e.x - m.x);
          e.x+=Math.cos(ang)*7; e.y+=Math.sin(ang)*7;
        }
        if(died){
          for(let k=0;k<12;k++){ const ang=Math.random()*Math.PI*2; this.particles.push(new Particle(e.x,e.y, Math.cos(ang)*randRange(1.4,3.8), Math.sin(ang)*randRange(1.2,3), 300, col, 2.5)); }
          if(Math.random()<0.18){
            const healAmt=Math.random()<0.7?1:2;
            const it=new HealingItem(e.x+randRange(-6,6), e.y+randRange(-6,6), healAmt);
            it.spawnDelay=300; this.currentRoom.items.push(it);
          }
        }
        // martelo onda de choque (uma vez por swing)
        if(m.weaponName==='MARTELO' && m.shockRadius>0 && !m._shockDone){
          m._shockDone=true;
          this.currentRoom.explosions.push({x:m.x, y:m.y, radius:14, life:300, max:300, isHammerShock:true});
          for(let k=0;k<14;k++){ const ang=Math.random()*Math.PI*2; this.particles.push(new Particle(m.x,m.y, Math.cos(ang)*randRange(1.2,3.2), Math.sin(ang)*randRange(1.2,3.2), 260, '#8a6d3b', 2)); }
          for(const other of this.currentRoom.enemies){
            if(other===e || other.dead) continue;
            // boss mãos já tratadas acima, aqui outros
            if(other.type==='stair_boss') continue;
            const d2=dist(m.x,m.y, other.x, other.y);
            if(d2 < m.shockRadius){
              const falloff=1 - (d2/m.shockRadius)*0.5;
              const sdmg=m.shockDamage*falloff;
              const sdied=other.takeDamage(sdmg);
              for(let kk=0;kk<3;kk++) this.particles.push(new Particle(other.x,other.y, randRange(-1,1), randRange(-1,0.4), 180, '#c2a87a', 1.8));
              if(sdied){
                for(let kk=0;kk<8;kk++){ const ang=Math.random()*Math.PI*2; this.particles.push(new Particle(other.x,other.y, Math.cos(ang)*randRange(1.2,2.8), Math.sin(ang)*randRange(1.2,2.8), 260, '#c2a87a', 2)); }
              } else {
                const ang=Math.atan2(other.y - m.y, other.x - m.x);
                other.x+=Math.cos(ang)*6*falloff; other.y+=Math.sin(ang)*6*falloff;
              }
            }
          }
          this.shake=Math.max(this.shake,62);
        }
      }
    }
    // colisão fist vs inimigos
    for(const f of this.fists){
      for(const e of this.currentRoom.enemies){
        if(e.dead) continue;
        if(f.hitEnemies.has(e)) continue;
        // também verifica mãos do boss
        let hit=false;
        let target=null;
        if(e.type==='stair_boss'){
          // testa mãos e cabeça separadamente
          if(!e.leftHand.dead && !e.leftHand.invulnerable && circleRectCollide(f.x,f.y,f.size, e.leftHand.x-e.leftHand.w/2, e.leftHand.y-e.leftHand.h/2, e.leftHand.w, e.leftHand.h)){
            hit=true; target=e.leftHand;
          } else if(!e.rightHand.dead && !e.rightHand.invulnerable && circleRectCollide(f.x,f.y,f.size, e.rightHand.x-e.rightHand.w/2, e.rightHand.y-e.rightHand.h/2, e.rightHand.w, e.rightHand.h)){
            hit=true; target=e.rightHand;
          } else if(!e.isHeadInvulnerable() && circleRectCollide(f.x,f.y,f.size, e.x-e.w/2, e.y-e.h/2, e.w, e.h)){
            hit=true; target=e;
          }
        } else {
          if(circleRectCollide(f.x,f.y,f.size, e.x-e.w/2, e.y-e.h/2, e.w, e.h)) { hit=true; target=e; }
        }
        if(hit){
          const dmg = f.returning ? f.returnDamage : f.damage;
          const died=target.takeDamage(dmg);
          f.hitEnemies.add(e);
          f.hitCount = (f.hitCount||0)+1;
          // Se acertou cabeça do boss, também marca e para não hitar mãos no mesmo frame
          for(let k=0;k<7;k++) this.particles.push(new Particle(target.x,target.y, randRange(-1.6,1.6), randRange(-1.4,0.6), 180, f.color, 2));
          if(target!==e){
            // hit foi numa mão, aplica knockback na mão
            const ang=Math.atan2(target.y - f.y, target.x - f.x);
            target.x+=Math.cos(ang)*9; target.y+=Math.sin(ang)*9;
          } else {
            const ang=Math.atan2(e.y - f.y, e.x - f.x);
            e.x+=Math.cos(ang)*9; e.y+=Math.sin(ang)*9;
          }
          if(died){
            for(let k=0;k<10;k++){ const ang=Math.random()*Math.PI*2; this.particles.push(new Particle(target.x,target.y, Math.cos(ang)*randRange(1.4,3.2), Math.sin(ang)*randRange(1.2,3.2), 280, f.color, 2)); }
          }
          // Luva perfurante: só retorna após atingir pierce+1 alvos
          if(!f.returning && f.hitCount > (f.pierce||0)){
            f.returning=true;
          }
          // só um inimigo por frame
          break;
        }
      }
    }
    // ===== BASTÃO JG - update do projétil giratório (sem duplicação) =====
    if(this.bastaoProjectiles && this.bastaoProjectiles.length){
      for(let i=this.bastaoProjectiles.length-1;i>=0;i--){
        const b=this.bastaoProjectiles[i];
        const alive=b.update(dt, this.player, this.currentRoom.walls, this.particles);
        // colisão com inimigos (perfura, gira causa dano contínuo)
        for(const e of this.currentRoom.enemies){
          if(e.dead) continue;
          if(b.hitEnemies.has(e)) continue;
          let hit=false;
          let target=null;
          if(e.type==='stair_boss'){
            if(!e.leftHand.dead && !e.leftHand.invulnerable && circleRectCollide(b.x,b.y,b.size, e.leftHand.x-e.leftHand.w/2, e.leftHand.y-e.leftHand.h/2, e.leftHand.w, e.leftHand.h)){ hit=true; target=e.leftHand; }
            else if(!e.rightHand.dead && !e.rightHand.invulnerable && circleRectCollide(b.x,b.y,b.size, e.rightHand.x-e.rightHand.w/2, e.rightHand.y-e.rightHand.h/2, e.rightHand.w, e.rightHand.h)){ hit=true; target=e.rightHand; }
            else if(!e.isHeadInvulnerable() && circleRectCollide(b.x,b.y,b.size, e.x-e.w/2, e.y-e.h/2, e.w, e.h)){ hit=true; target=e; }
          } else {
            if(circleRectCollide(b.x,b.y,b.size+2, e.x-e.w/2, e.y-e.h/2, e.w, e.h)){ hit=true; target=e; }
          }
          if(hit){
            const died=target.takeDamage(b.damage);
            b.hitEnemies.add(e);
            for(let k=0;k<6;k++) this.particles.push(new Particle(target.x,target.y, randRange(-1.5,1.5), randRange(-1.5,0.5), 180, '#facc15', 2));
            const ang=Math.atan2(target.y - b.y, target.x - b.x);
            target.x+=Math.cos(ang)*18; target.y+=Math.sin(ang)*18;
            target.hitFlash=Math.max(target.hitFlash||0, 160);
            if(target.stunTimer!==undefined) target.stunTimer=Math.max(target.stunTimer||0, 220);
            if(died){
              for(let k=0;k<10;k++){ const ang2=Math.random()*Math.PI*2; this.particles.push(new Particle(target.x,target.y, Math.cos(ang2)*randRange(1.4,3), Math.sin(ang2)*randRange(1.2,3), 280, '#facc15', 2)); }
            }
            // bastão perfura: não destrói ao acertar, continua voando (hitEnemies evita dano repetido no mesmo alvo no mesmo arremesso, mas poderia limpar ao retornar? mantemos)
            // Para permitir que bastão continue causando dano na volta, não adicionamos hitEnemies de forma permanente? Mantemos Set para evitar múltiplos hits no mesmo voo curto.
          }
        }
        // reflexão de projéteis inimigos - bastão rebate tiro, inverte direção e causa dano ao inimigo
        for(let j=this.bullets.length-1;j>=0;j--){
          const eb=this.bullets[j];
          if(eb.owner!=='enemy' || eb.dead) continue;
          if(dist(b.x,b.y,eb.x,eb.y) < b.size + eb.size + 3){
            eb.owner='player';
            eb.dirX*=-1; eb.dirY*=-1;
            const ang=Math.atan2(eb.dirY, eb.dirX) + randRange(-0.15,0.15);
            eb.dirX=Math.cos(ang); eb.dirY=Math.sin(ang);
            eb.damage = Math.max(eb.damage*1.4, b.damage*0.9);
            eb.color='#facc15';
            eb.glow='rgba(250,204,21,0.38)';
            eb.speed = Math.max(eb.speed*1.15, b.speed*0.85);
            eb.hitEnemies.clear();
            eb.traveled=0;
            eb.range = Math.max(eb.range, 420);
            for(let k=0;k<8;k++) this.particles.push(new Particle(eb.x,eb.y, eb.dirX*randRange(0.8,1.6)+randRange(-0.4,0.4), eb.dirY*randRange(0.8,1.6)+randRange(-0.4,0.4), 220, '#facc15', 1.8));
            for(let k=0;k<4;k++) this.particles.push(new Particle(b.x,b.y, randRange(-1.2,1.2), randRange(-0.8,0.4), 180, '#fff8a0', 1.6));
            this.shake=Math.max(this.shake, 28);
          }
        }
        if(!alive || b.dead){
          // retornou ao jogador
          if(this.player.characterId==='jg'){
            this.player.returnBastao();
            this.showToast('🏏 Bastão retornou!', 900);
            for(let k=0;k<10;k++) this.particles.push(new Particle(this.player.x,this.player.y, randRange(-1.2,1.2), randRange(-1.2,0.4), 220, '#facc15', 2));
            this.shake=Math.max(this.shake, 35);
          }
          this.bastaoProjectiles.splice(i,1);
          if(this.player.bastaoProjectile===b) this.player.bastaoProjectile=null;
        }
      }
    }

    // room + enemies + items update
    const beforeEnemies=this.currentRoom.enemies.length;
    const tempEnemyBullets=[];
    this.currentRoom.update(dt, this.player, this.bullets, this.particles, tempEnemyBullets);
    // adiciona novos tiros de fugitivo
    for(const eb of tempEnemyBullets) this.bullets.push(eb);

    // detecta coleta de item para toast (verifica antes/depois count?)
    // Como Room já remove itens coletados, precisamos detectar via contagem ou via heal/arma
    // Vamos verificar se player curou ou trocou arma: para isso, intercepção seria dentro de Item.onCollect, mas fazemos toast aqui detectando mudança de HP/arma
    // Alternativa simples: monitorar itens antes e depois; se removeu, mostra toast baseado no tipo removido
    // Já temos spawn de partículas, mas toast será emitido se HP aumentou ou arma mudou. Guardamos estados.
    // Para simplificar, vamos guardar lastHp e lastWeapon
    if(this._lastHp===undefined) this._lastHp=this.player.hp;
    if(this._lastWeapon===undefined) this._lastWeapon=this.player.weapon.name;
    if(this._lastFlame===undefined) this._lastFlame=this.player.hasFlameTrail;
    if(this._lastSpeed===undefined) this._lastSpeed=this.player.speed;
    if(this._lastDoubleShot===undefined) this._lastDoubleShot=this.player.hasDoubleShot;
    if(this._lastUpgradeCount===undefined) this._lastUpgradeCount=this.player.obtainedUpgrades.size;
    if(this._lastSpecialId===undefined) this._lastSpecialId = this.player.equippedSpecial ? this.player.equippedSpecial.id : null;
    if(this.player.hp > this._lastHp){
      const diff=this.player.hp - this._lastHp;
      this.showToast(`♥ +${diff} vida ${diff===2?'(1 coração)':'(½ coração)'}`, 1400);
      for(let k=0;k<10;k++) this.particles.push(new Particle(this.player.x,this.player.y-12, randRange(-1.5,1.5), randRange(-2,-0.5), 360, '#4ade80', 3));
    }
    if(this.player.weapon.name !== this._lastWeapon){
      if(this.player.weapon.name==='SHOTGUN'){
        this.showToast('⬢ SHOTGUN EQUIPADA! 5 projéteis • dano alto • alcance curto [Q troca]', 2500);
        for(let k=0;k<16;k++){ const ang=Math.random()*Math.PI*2; this.particles.push(new Particle(this.player.x,this.player.y, Math.cos(ang)*randRange(1.5,4), Math.sin(ang)*randRange(1.5,4), 420, '#ff8c42', 3)); }
      } else if(this.player.weapon.name==='RAIO'){
        this.showToast('⚡ RAIO EQUIPADO! Perfurante • dano 3 • alcance longo [Q troca]', 2800);
        for(let k=0;k<18;k++){ const ang=Math.random()*Math.PI*2; this.particles.push(new Particle(this.player.x,this.player.y, Math.cos(ang)*randRange(1.5,5), Math.sin(ang)*randRange(1.5,5), 440, '#00e5ff', 3)); }
      } else if(this.player.weapon.name==='METRALHADORA'){
        this.showToast('🔥 METRALHADORA EQUIPADA! Segure para disparar • Cuidado com superaquecimento [Q]', 2800);
        for(let k=0;k<18;k++){ const ang=Math.random()*Math.PI*2; this.particles.push(new Particle(this.player.x,this.player.y, Math.cos(ang)*randRange(1.5,4), Math.sin(ang)*randRange(1.5,4), 380, '#ff3b30', 3)); }
      } else if(this.player.weapon.name==='CARREGADA'){
        this.showToast('◉ CARREGADA EQUIPADA! Segure seta para carregar • solte para disparar forte [Q]', 2800);
        for(let k=0;k<16;k++){ const ang=Math.random()*Math.PI*2; this.particles.push(new Particle(this.player.x,this.player.y, Math.cos(ang)*randRange(1.4,3.8), Math.sin(ang)*randRange(1.4,3.8), 420, '#a78bfa', 3)); }
      } else if(this.player.weapon.name==='ESPADA'){
        this.showToast('⚔️ ESPADA MELHORADA! Combo 3 golpes + lunge + onda no pesado! [Q]', 2800);
        for(let k=0;k<16;k++){ const ang=Math.random()*Math.PI*2; this.particles.push(new Particle(this.player.x,this.player.y, Math.cos(ang)*randRange(1.6,3.8), Math.sin(ang)*randRange(1.6,3.8), 420, '#e8e8e8', 3)); }
      } else if(this.player.weapon.name==='LUVA'){
        this.showToast('🥊 LUVA DUAL EQUIPADA! 2 punhos lado a lado • vai e volta [Q]', 2800);
        for(let k=0;k<16;k++){ const ang=Math.random()*Math.PI*2; this.particles.push(new Particle(this.player.x,this.player.y, Math.cos(ang)*randRange(1.6,3.6), Math.sin(ang)*randRange(1.6,3.6), 380, '#ff3b30', 3)); }
      } else if(this.player.weapon.name==='MOTOSSERRA'){
        const hasPochita=this.player.weapon.hasPochita?' + POCHITA 🪚x3':'';
        this.showToast(`🪚 MOTOSSERRA EQUIPADA${hasPochita}! Curta distância • dano alto [Q]`, 2800);
        for(let k=0;k<16;k++){ const ang=Math.random()*Math.PI*2; this.particles.push(new Particle(this.player.x,this.player.y, Math.cos(ang)*randRange(1.6,3.8), Math.sin(ang)*randRange(1.6,3.8), 420, '#ff3b30', 3)); }
      } else if(this.player.weapon.name==='BASTAO'){
        this.showToast('🏏 BASTÃO EQUIPADO! Corpo a corpo + arremesso giratório [Q]', 2400);
        for(let k=0;k<14;k++){ const ang=Math.random()*Math.PI*2; this.particles.push(new Particle(this.player.x,this.player.y, Math.cos(ang)*randRange(1.5,3.8), Math.sin(ang)*randRange(1.5,3.8), 360, '#facc15', 3)); }

      } else {
        const lastIsSpecial = this._lastWeapon==='SHOTGUN' || this._lastWeapon==='RAIO' || this._lastWeapon==='METRALHADORA' || this._lastWeapon==='CARREGADA' || this._lastWeapon==='BAZUCA' || this._lastWeapon==='ESPADA' || this._lastWeapon==='LUVA' || this._lastWeapon==='MOTOSSERRA' || this._lastWeapon==='BASTAO';
        if(lastIsSpecial) this.showToast(`↔ ${this._lastWeapon} → ${this.player.weapon.name} [Q]`, 1200);
        else this.showToast(`Arma trocada → ${this.player.weapon.name}`, 1200);
      }
    }
    if(!this._lastFlame && this.player.hasFlameTrail){
      this.showToast('🔥 RASTRO DE FOGO! Dash deixa chamas (dano periódico)', 2800);
      for(let k=0;k<20;k++){ const ang=Math.random()*Math.PI*2; this.particles.push(new Particle(this.player.x,this.player.y, Math.cos(ang)*randRange(1.2,3.5), Math.sin(ang)*randRange(1.2,3.5), 460, '#ff6a00', 3)); }
    }
    if(!this._lastDoubleShot && this.player.hasDoubleShot){
      this.showToast('✦ TIRO DUPLO! Arma principal dispara 2 projéteis lado a lado', 2600);
      for(let k=0;k<16;k++){ const ang=Math.random()*Math.PI*2; this.particles.push(new Particle(this.player.x,this.player.y, Math.cos(ang)*randRange(1.5,3.5), Math.sin(ang)*randRange(1.5,3.5), 420, '#5a8fd4', 3)); }
    }
    if(this.player.speed > this._lastSpeed + 0.01){
      this.showToast('💨 BOTAS VELOZES! Velocidade +', 2000);
      for(let k=0;k<14;k++){ const ang=Math.random()*Math.PI*2; this.particles.push(new Particle(this.player.x,this.player.y, Math.cos(ang)*randRange(1,3), Math.sin(ang)*randRange(1,3), 360, '#00d9ff', 3)); }
    }
    // detecção de melhoria coletada (mostra raridade, nome e efeito com cor)
    if(this.player.obtainedUpgrades.size > this._lastUpgradeCount){
      // detecção com níveis: mostra toast para novos ou nível aumentado
      const curLevels = new Map(this.player.upgradeLevels);
      for(const id of this.player.obtainedUpgrades){
        if(!curLevels.has(id)) curLevels.set(id, 1);
      }
      const lastLevels = this._lastUpgradeLevels || new Map();
      const changedIds = [];
      for(const [id, lvl] of curLevels){
        const lastLvl = lastLevels.get(id) || 0;
        if(lvl > lastLvl) changedIds.push(id);
      }
      for(const nid of changedIds){
        const def = UPGRADE_MAP.get(nid);
        if(def){
          const r = RARITY[def.rarity];
          const lvl = curLevels.get(nid) || 1;
          const maxLv = def.maxLevel || 1;
          const levelStr = maxLv>1 ? ` Nv${lvl}/${maxLv}` : '';
          const compat = def.compatible || [def.weapon];
          const compatStr = compat.includes('ALL') ? 'TODAS' : compat.join(',');
          const weaponStr = def.weapon==='ALL' ? 'TODAS' : compatStr;
          this.showToast(`★ ${r.name} ${def.name}${levelStr} [${weaponStr}] - ${def.desc}`, 3200);
          const col = r.color;
          for(let k=0;k<16;k++){ const ang=Math.random()*Math.PI*2; this.particles.push(new Particle(this.player.x,this.player.y, Math.cos(ang)*randRange(1.5,4.5), Math.sin(ang)*randRange(1.5,4.5), 480, col, 3)); }
          if(r.id==='MUITO_RARA'){
            for(let k=0;k<10;k++) this.particles.push(new Particle(this.player.x,this.player.y, Math.cos(Math.random()*Math.PI*2)*randRange(2,5), Math.sin(Math.random()*Math.PI*2)*randRange(2,5), 420, r.gold||'#ffd700', 2.5));
          }
        }
      }
    }
    // Detecção de item especial equipado (para toast quando coleta SpecialItemPickup)
    const curSpecialId = this.player.equippedSpecial ? this.player.equippedSpecial.id : null;
    if(curSpecialId !== this._lastSpecialId){
      if(curSpecialId){
        const sp = this.player.equippedSpecial;
        this.showToast(`★ ${sp.name} equipado! Pressione [E] para ativar • Cooldown ${sp.cooldown/1000}s`, 2600);
        for(let k=0;k<16;k++){ const ang=Math.random()*Math.PI*2; this.particles.push(new Particle(this.player.x,this.player.y, Math.cos(ang)*randRange(1.4,4), Math.sin(ang)*randRange(1.4,4), 420, sp.color, 3)); }
      } else {
        // desequipar? não usado, mas previsto
        this.showToast('Item especial removido', 1200);
      }
    }
    this._lastSpecialId = curSpecialId;
    this._lastHp=this.player.hp;
    this._lastWeapon=this.player.weapon.name;
    this._lastFlame=this.player.hasFlameTrail;
    this._lastSpeed=this.player.speed;
    this._lastDoubleShot=this.player.hasDoubleShot;
    this._lastUpgradeCount=this.player.obtainedUpgrades.size;
    {
      const finalLevels = new Map(this.player.upgradeLevels);
      for(const id of this.player.obtainedUpgrades) if(!finalLevels.has(id)) finalLevels.set(id,1);
      this._lastUpgradeLevels = new Map(finalLevels);
    }

    const defeatedNow=beforeEnemies - this.currentRoom.enemies.length;
    if(defeatedNow>0){
      this.enemiesDefeated += defeatedNow;
      this.shake=90;
      if(this.currentRoom.isCleared()){
        this.showToast('✓ Sala limpa! Portas liberadas', 1500);
        for(let i=0;i<12;i++){ const ang=Math.random()*Math.PI*2; this.particles.push(new Particle(CANVAS_W/2,CANVAS_H/2, Math.cos(ang)*randRange(1,4), Math.sin(ang)*randRange(1,4), 420, this.floor===2?'#ff8c42':'#4ade80', 3)); }
      }
    }

    for(let i=this.particles.length-1;i>=0;i--) if(!this.particles[i].update(dt)) this.particles.splice(i,1);

    this.checkRoomTransition();
    this.checkExitPortal();

    if(!this.player.isAlive()){
      this.state='GAMEOVER';
      const title=document.getElementById('gameOverTitle');
      const stats=document.getElementById('gameOverStats');
      title.textContent='RÉQUIEM INTERROMPIDO';
      title.style.color='#ff3b30';
      stats.innerHTML=`Cyber Requiem • Ato <b>${this.floor}</b> • Sala ${this.currentRoom.gx},${this.currentRoom.gy} • Explorou <b>${this.roomsExplored}/${this.rooms.length}</b> salas neste ato<br>Derrotou <b>${this.totalEnemiesDefeated + this.enemiesDefeated}</b> inimigos • Arma: ${this.player.weapon.name}<br>Seed: ${this.seed}<br><span style="color:#8a8198;font-size:12px">Mundo cibernético ainda corrompido — tente novamente, o sistema reinicia.</span>`;
      this.gameOverScreen.classList.add('active');
    }

    // vitória antiga (todas salas limpas) agora é só trigger para portal; mantém fallback se portal não alcançado mas tudo limpo e visitado
    // Se já está na fase 2 e tudo limpo, portal levará à vitória total via advanceFloor, então não precisa checar aqui

    // HUD auto-hide: fica mais translúcido quando ocioso para não atrapalhar mapa (vida/itens)
    const isMoving = this.input.getMoveVector().x!==0 || this.input.getMoveVector().y!==0 || !!this.input.getShootVector() || this.input.isDashPressed();
    const hudTopEl=document.querySelector('.hud-top');
    const hudBottomEl=document.querySelector('.hud-bottom');
    if(isMoving || this.player.shootCooldown>0 || this.player.dashTimer>0){
      this._hudIdleTimer=0;
      hudTopEl?.classList.remove('idle');
      hudBottomEl?.classList.remove('idle');
    } else {
      this._hudIdleTimer+=dt;
      if(this._hudIdleTimer>1800){
        hudTopEl?.classList.add('idle');
        hudBottomEl?.classList.add('idle');
      }
    }

    this.input.update();
    this.updateHUD();
    }catch(e){ console.error('Game update error', e); }
  }

  updateHUD(){
    if(this.hudHeartsDom){
      this.hudHeartsDom.innerHTML='';
      const totalHearts = Math.ceil(this.player.maxHp / 2);
      const boneHearts = this.player.boneHearts |0;
      const redCap = BONE_HEART_RED_CAPACITY;
      for(let i=0;i<totalHearts;i++){
        const hp = clamp(this.player.hp - i*2, 0, 2);
        const isBone = i >= totalHearts - boneHearts;
        const el=document.createElement('div'); el.className='hud-heart'; el.title = isBone ? 'Coração Cibernético (Bone) - recipiente cinza' : 'Coração Vermelho';
        const c=document.createElement('canvas'); c.width=28; c.height=28; const cx=c.getContext('2d');
        cx.clearRect(0,0,28,28);
        const size=22; cx.save(); cx.translate(3,3);
        cx.fillStyle='rgba(0,0,0,0.35)'; drawHeartPath(cx,1,2,size); cx.fill();
        if(isBone){
          // Bone Heart HUD - ciano acinzentado metálico
          cx.fillStyle='#1a2530'; drawHeartPath(cx,0,0,size); cx.fill();
          cx.strokeStyle='#4a6a7a'; cx.lineWidth=1.4; cx.stroke();
          if(hp>=2){ cx.fillStyle='#8ecae6'; drawHeartPath(cx,0,0,size); cx.fill(); cx.fillStyle='rgba(255,255,255,0.72)'; cx.beginPath(); cx.arc(6,5,2.0,0,Math.PI*2); cx.fill(); cx.strokeStyle='rgba(0,229,255,0.45)'; cx.lineWidth=1.0; drawHeartPath(cx,0,0,size); cx.stroke(); }
          else if(hp===1){ cx.save(); cx.beginPath(); drawHeartPath(cx,0,0,size); cx.clip(); cx.fillStyle='#8ecae6'; cx.fillRect(0,0,size/2+0.5,size); cx.restore(); cx.strokeStyle='rgba(0,229,255,0.35)'; cx.lineWidth=1.0; drawHeartPath(cx,0,0,size); cx.stroke(); }
          else { cx.strokeStyle='rgba(140,160,180,0.14)'; cx.lineWidth=1; cx.beginPath(); cx.moveTo(size*0.5,4); cx.lineTo(size*0.5 -2,8); cx.lineTo(size*0.5+1,11); cx.lineTo(size*0.5,15); cx.stroke(); }
        } else {
          cx.fillStyle='#2a1a1a'; drawHeartPath(cx,0,0,size); cx.fill();
          cx.strokeStyle='#5a2a2a'; cx.lineWidth=1.5; cx.stroke();
          if(hp>=2){ cx.fillStyle='#ff3b30'; drawHeartPath(cx,0,0,size); cx.fill(); cx.fillStyle='rgba(255,255,255,0.7)'; cx.beginPath(); cx.arc(6,5,2.2,0,Math.PI*2); cx.fill(); }
          else if(hp===1){ cx.save(); cx.beginPath(); drawHeartPath(cx,0,0,size); cx.clip(); cx.fillStyle='#ff3b30'; cx.fillRect(0,0,size/2+0.5,size); cx.restore(); }
          else { cx.strokeStyle='rgba(255,255,255,0.06)'; cx.lineWidth=1; cx.beginPath(); cx.moveTo(size*0.5,4); cx.lineTo(size*0.5 -2,8); cx.lineTo(size*0.5+1,11); cx.lineTo(size*0.5,15); cx.stroke(); }
        }
        cx.restore();
        el.appendChild(c); this.hudHeartsDom.appendChild(el);
      }
    }
    const pct = this.player.dashCooldown<=0 ? 100 : clamp(100 - (this.player.dashCooldown / DASH_COOLDOWN)*100, 0, 100);
    this.hudDashFill.style.width = pct+'%';
    this.hudDashFill.style.opacity = this.player.dashCooldown<=0 ? '1' : '0.7';
    this.hudDashFill.style.background = this.player.dashCooldown<=0 ? 'linear-gradient(90deg,#00d9ff,#7af)' : 'linear-gradient(90deg,#555,#777)';
    // temperatura metralhadora
    if(this.tempBar && this.tempFill){
      if(this.player.weapon && this.player.weapon.name==='METRALHADORA'){
        this.tempBar.style.display='flex';
        const tpct = clamp(this.player.miniHeat / METRALHADORA_HEAT_MAX * 100, 0, 100);
        this.tempFill.style.width = tpct+'%';
        if(this.player.isOverheated){
          this.tempFill.style.background='linear-gradient(90deg,#ff1a1a,#ff6a00)';
          if(this.tempLabel) this.tempLabel.textContent='SUPERAQUECIDA! ' + Math.round(tpct)+'%';
        } else {
          this.tempFill.style.background = tpct>75 ? 'linear-gradient(90deg,#ff3b30,#ffcc00)' : tpct>45 ? 'linear-gradient(90deg,#ff6a00,#ffcc00)' : 'linear-gradient(90deg,#00ff88,#ffcc00)';
          if(this.tempLabel) this.tempLabel.textContent='TEMP '+Math.round(tpct)+'%';
        }
      } else {
        this.tempBar.style.display='none';
      }
    }
    // barra carregada (arma comum com carga) + MOTOSSERRA cura + DEV Raio Matemático
    if(this.chargeBar && this.chargeFill){
      if(this.player.weapon && this.player.weapon.name==='RAIO_MATEMATICO'){
        this.chargeBar.style.display='flex';
        const prog = this.player.getRayMatematicoProgress();
        const pct = clamp(prog*100, 0, 100);
        this.chargeFill.style.width = pct + '%';
        const hasSobremesa = this.player.hasSobremesa();
        const miniCount = this.player.rayMatematicoFiredThresholds ? this.player.rayMatematicoFiredThresholds.size : 0;
        if(this.player.isRayMatematicoCharging){
          // Gradiente ciano -> branco quando pronto, pulso no 100%
          this.chargeFill.style.background = pct>92 ? 'linear-gradient(90deg,#7af2ff,#ffffff)' : pct>55 ? 'linear-gradient(90deg,#1a8fb3,#7af2ff)' : 'linear-gradient(90deg,#0a4a5e,#1a8fb3)';
          const sobStr = hasSobremesa ? ` • 🧁 ${miniCount}/10 mini` : '';
          if(this.chargeLabel) this.chargeLabel.textContent = pct>=99 ? `PRONTO! ${pct.toFixed(0)}% • SOLTE!${sobStr}` : `LAZER ${pct.toFixed(0)}% • Segure...${sobStr}`;
          if(pct>=99) this.chargeBar.style.boxShadow='0 0 10px rgba(184,255,251,0.55)';
          else if(pct>70) this.chargeBar.style.boxShadow='0 0 6px rgba(122,242,255,0.32)';
          else this.chargeBar.style.boxShadow='none';
        } else {
          this.chargeFill.style.background = this.player.canShoot() ? 'linear-gradient(90deg,#0a4a5e,#1a8fb3)' : 'linear-gradient(90deg,#333,#555)';
          this.chargeFill.style.width = '0%';
          if(this.chargeLabel) this.chargeLabel.textContent = this.player.shootCooldown>0 ? 'RECARREGANDO...' : `PRONTA • segure seta [🧁 ${hasSobremesa ? 'ON' : 'OFF'}]`;
          this.chargeBar.style.boxShadow='none';
        }
      } else if(this.player.weapon && this.player.weapon.name==='CARREGADA'){
        this.chargeBar.style.display='flex';
        const prog = this.player.getChargeProgress();
        const pct = clamp(prog*100, 0, 100);
        this.chargeFill.style.width = pct + '%';
        if(this.player.isCharging){
          this.chargeFill.style.background = pct>85 ? 'linear-gradient(90deg,#d8b4fe,#ffffff)' : pct>45 ? 'linear-gradient(90deg,#7c3aed,#a78bfa)' : 'linear-gradient(90deg,#4c1d95,#7c3aed)';
          if(this.chargeLabel) this.chargeLabel.textContent = pct>=99 ? 'MÁX • ' + pct.toFixed(0)+'% • '+this.player.getChargeDamage().toFixed(1)+' dano' : 'CARGA '+pct.toFixed(0)+'% • '+this.player.getChargeDamage().toFixed(1)+' dano';
        } else {
          this.chargeFill.style.background = 'linear-gradient(90deg,#4c1d95,#7c3aed)';
          this.chargeFill.style.width = '0%';
          if(this.chargeLabel) this.chargeLabel.textContent = this.player.canShoot() ? 'PRONTA • segure seta' : 'RECARREGANDO...';
        }
      } else if(this.player.weapon && this.player.weapon.name==='MOTOSSERRA'){
        this.chargeBar.style.display='flex';
        const pct = clamp(this.player.getMotosserraChargePct()*100, 0, 100);
        this.chargeFill.style.width = pct + '%';
        if(pct>=100){
          this.chargeFill.style.background = 'linear-gradient(90deg,#4ade80,#ffffff)';
          if(this.chargeLabel) this.chargeLabel.textContent = '♥ CURA PRONTA! +1 coração';
        } else if(pct>75){
          this.chargeFill.style.background = 'linear-gradient(90deg,#ff3b30,#ffcc00)';
          if(this.chargeLabel) this.chargeLabel.textContent = `SERRA ${pct.toFixed(0)}% • ${Math.ceil((100-pct)/20)} hits p/ curar`;
        } else if(pct>35){
          this.chargeFill.style.background = 'linear-gradient(90deg,#ff2a1a,#ff8c42)';
          if(this.chargeLabel) this.chargeLabel.textContent = `SERRA ${pct.toFixed(0)}% • ataque reto curto`;
        } else {
          this.chargeFill.style.background = 'linear-gradient(90deg,#7a1a1a,#ff2a1a)';
          if(this.chargeLabel) this.chargeLabel.textContent = `SERRA ${pct.toFixed(0)}% • 5 hits = +1♥`;
        }
        // brilho quando quase cheia
        if(pct>85){
          this.chargeBar.style.boxShadow = '0 0 8px rgba(74,222,128,0.35)';
        } else {
          this.chargeBar.style.boxShadow = 'none';
        }
      } else {
        this.chargeBar.style.display='none';
        this.chargeBar.style.boxShadow='none';
      }
    }
    // barra luva - carga foguete
    if(this.luvaBar && this.luvaFill){
      if(this.player.weapon && this.player.weapon.isLuva){
        this.luvaBar.style.display='flex';
        const pct = clamp(this.player.luvaCharge / this.player.luvaChargeMax * 100, 0, 100);
        this.luvaFill.style.width = pct+'%';
        if(pct>=99.5){
          this.luvaFill.style.background = 'linear-gradient(90deg,#ffd700,#ffffff)';
          if(this.luvaLabel) this.luvaLabel.textContent = 'FOGUETE PRONTO! [ATIRE]';
          this.luvaBar.style.boxShadow='0 0 10px rgba(255,215,0,0.45)';
        } else if(this.player.luvaIsCharging){
          this.luvaFill.style.background = pct>60 ? 'linear-gradient(90deg,#ff3b30,#ffd700)' : 'linear-gradient(90deg,#ff3b30,#ff8c42)';
          if(this.luvaLabel) this.luvaLabel.textContent = `CARGA ${pct.toFixed(0)}% • ${Math.round(lerp(LUVA_PUNCH_BASE, LUVA_PUNCH_MIN, pct/100))}ms soco`;
          this.luvaBar.style.boxShadow='none';
        } else {
          this.luvaFill.style.background = 'linear-gradient(90deg,#ff3b30,#ff8c42)';
          if(this.luvaLabel) this.luvaLabel.textContent = `LUVA ${pct.toFixed(0)}% • segure ataque`;
          this.luvaBar.style.boxShadow='none';
        }
      } else {
        this.luvaBar.style.display='none';
        this.luvaBar.style.boxShadow='none';
      }
    }
    // melhorias por arma (mostra raridade, nome, nível, compatíveis) - com níveis até 3
    if(this.upgradeHud && this.upgradeList){
      const wName = this.player.weapon ? this.player.weapon.name : null;
      let ids = [];
      let all = [];
      if(wName){
        const specific = this.player.weaponUpgrades[wName]||[];
        const generic = this.player.weaponUpgrades['ALL']||[];
        all = [...specific];
        for(const gid of generic){
          const def = UPGRADE_MAP.get(gid);
          if(!def) continue;
          const compat = def.compatible || [def.weapon];
          if(compat.includes(wName) || compat.includes('ALL') || def.weapon==='ALL'){
            if(!all.includes(gid)) all.push(gid);
          }
        }
        ids = [...all];
      }
      // inclui melhorias especiais (ex: Circuito Ágil - recarga E) - sempre visível
      const specialIds = this.player.weaponUpgrades['SPECIAL']||[];
      for(const sid of specialIds){ if(!ids.includes(sid)) ids.push(sid); }
      // dedup
      ids = [...new Set(ids)];
      if(ids.length>0){
        this.upgradeHud.style.display='flex';
        this.upgradeList.innerHTML='';
        for(const uid of ids){
          const def = UPGRADE_MAP.get(uid);
          if(!def) continue;
          const r = RARITY[def.rarity];
          const lvl = this.player.upgradeLevels.get(uid) || 1;
          const maxLv = def.maxLevel || 1;
          const el=document.createElement('div');
          el.className='upgrade-chip';
          el.style.borderColor = r.border;
          el.style.background = r.bg;
          el.style.color = r.color;
          if(r.id==='MUITO_RARA') el.style.boxShadow = '0 0 6px ' + r.glow;
          const compat = def.compatible || [def.weapon];
          const compatStr = compat.includes('ALL') ? 'TODAS' : compat.join(',');
          el.title = `${r.name} ${def.name} ${maxLv>1?`Nv${lvl}/${maxLv}`:''} [${compatStr}]: ${def.desc}`;
          el.textContent = `${def.name}${maxLv>1?` ${lvl}/${maxLv}`:''}`;
          // bolinha cor arma + nível
          const dot=document.createElement('span');
          dot.className='upgrade-dot';
          dot.style.background = r.color;
          if(r.id==='MUITO_RARA') dot.style.background = r.gold;
          el.prepend(dot);
          // pontos de nível
          if(maxLv>1){
            const dots=document.createElement('span');
            dots.style.fontSize='5px';
            dots.style.marginLeft='3px';
            dots.textContent = '•'.repeat(lvl) + '○'.repeat(maxLv-lvl);
            el.appendChild(dots);
          }
          this.upgradeList.appendChild(el);
        }
      } else {
        // mostra total de melhorias se houver em outras armas (inclui níveis)
        let totalLevels = 0;
        for(const v of this.player.upgradeLevels.values()) totalLevels+=v;
        const totalIds = this.player.obtainedUpgrades ? this.player.obtainedUpgrades.size : 0;
        const displayTotal = totalLevels || totalIds;
        if(displayTotal>0){
          this.upgradeHud.style.display='flex';
          this.upgradeList.innerHTML=`<span style="font-size:6px;color:#8a8198">${displayTotal} níveis • troque arma para ver</span>`;
        } else {
          this.upgradeHud.style.display='none';
        }
      }
    }
    const curEnemies=this.currentRoom?this.currentRoom.enemies.length:0;
    const totalEnemies=this.rooms.reduce((a,r)=>a+r.enemies.length,0);
    const locked=this.currentRoom && !this.currentRoom.isCleared();
    this.hudEnemies.textContent=`INIMIGOS: ${curEnemies} ${locked?'🔒':''} • TOTAL: ${totalEnemies}`;
    this.hudRoom.textContent=`SALA ${this.currentRoom?`${this.currentRoom.gx},${this.currentRoom.gy}`:'-'} • ${this.roomsExplored}/${this.rooms.length}`;
    if(this.hudFloor){
      // se sala boss/mini/festa/hacker, mostra indicação especial (prioridade Hacker > Boss)
      if(this.currentRoom && this.currentRoom.isHacker){
        const locked=!this.currentRoom.isCleared() && !this.currentRoom.hackerDefeated;
        if(this.currentRoom.hackerDefeated){
          this.hudFloor.textContent=`✓ HACKER ANIQUILADO - FASE ${this.floor}`;
          this.hudFloor.className='hud-floor rare';
        } else {
          const hacker=this.currentRoom.enemies.find(e=>e.type==='hacker');
          const hpTxt=hacker?` ${Math.ceil(hacker.hp)}/${hacker.maxHp} HP`:'';
          const phaseTxt=hacker?` F${hacker.getPhase()}`:'';
          this.hudFloor.textContent=locked?`◉ HACKER${hpTxt}${phaseTxt} - FASE ${this.floor}`:`◉ HACKER - FASE ${this.floor}`;
          this.hudFloor.className='hud-floor hacker';
        }
      } else if(this.currentRoom && this.currentRoom.isPartyHorde){
        const locked = !this.currentRoom.isCleared();
        if(this.currentRoom.partyHordeDefeated){
          this.hudFloor.textContent = `♪ FESTA VENCIDA! - FASE ${this.floor}`;
          this.hudFloor.className = 'hud-floor rare';
        } else {
          const wave = this.currentRoom.partyWave;
          const total = PARTY_HORDE_WAVES;
          const ene = this.currentRoom.enemies.length;
          this.hudFloor.textContent = locked ? `★ FESTA HORDA ONDA ${wave}/${total} • ${ene} INIMIGOS - FASE ${this.floor}` : `★ FESTA HORDA - FASE ${this.floor}`;
          this.hudFloor.className = 'hud-floor party';
        }
      } else if(this.currentRoom && this.currentRoom.isBossStair){
        const locked = !this.currentRoom.isCleared() && !this.currentRoom.bossStairDefeated;
        if(this.currentRoom.bossStairDefeated){
          this.hudFloor.textContent = `✓ BOSS ESCADA VENCIDO - FASE ${this.floor}`;
          this.hudFloor.className = 'hud-floor rare';
        } else {
          const boss=this.currentRoom.enemies.find(e=> e.type==='stair_boss');
          const hpTxt=boss? ` ${Math.ceil(boss.hp)}/${boss.maxHp} HP` : '';
          this.hudFloor.textContent = locked ? `◉ BOSS ESCADA${hpTxt} - FASE ${this.floor}` : `◉ BOSS ESCADA - FASE ${this.floor}`;
          this.hudFloor.className = 'hud-floor phase5';
        }
      } else if(this.currentRoom && this.currentRoom.isMiniboss){
        const locked = !this.currentRoom.isCleared();
        this.hudFloor.textContent = locked ? `◉ MINIBOSS - FASE ${this.floor}` : `✓ MINIBOSS VENCIDO - FASE ${this.floor}`;
        this.hudFloor.className = locked ? 'hud-floor phase4' : 'hud-floor rare';
      } else if(this.currentRoom && this.currentRoom.isRare){
        this.hudFloor.textContent=`★ SALA RARA ★ - FASE ${this.floor}`;
        this.hudFloor.className='hud-floor rare';
      } else {
        this.hudFloor.textContent=`FASE ${this.floor} • ${FLOOR_THEMES[this.floor].name}`;
        this.hudFloor.className='hud-floor';
        if(this.floor===2) this.hudFloor.classList.add('phase2');
        else if(this.floor===3) this.hudFloor.classList.add('phase3');
        else if(this.floor===4) this.hudFloor.classList.add('phase4');
        else if(this.floor===5) this.hudFloor.classList.add('phase5');
      }
    }
    if(this.hudWeapon){
      // mostra arma equipada + secundária se existir (usa displayName para LAZER CODIFICADO)
      const getDisp = (w)=> w.displayName || (w.name==='RAIO_MATEMATICO' ? 'LAZER CODIFICADO' : w.name);
      let txt = getDisp(this.player.weapon);
      if(this.player.secondaryWeapon){
        const otherW = this.player.weapon === this.player.primaryWeapon ? this.player.secondaryWeapon : this.player.primaryWeapon;
        const other = getDisp(otherW);
        txt += ` [Q:${other}]`;
      } else {
        txt += ` [Q]`;
      }
      if(this.player.hasFlameTrail) txt += ` 🔥`;
      if(this.player._hasSwiftBoots) txt += ` 💨`;
      if(this.player.hasDoubleShot) txt += ` x2`;
      if(this.player.weapon.hasPochita) txt += ` 🪚x3`;
      this.hudWeapon.textContent=txt;
      this.hudWeapon.className='weapon-name';
      if(this.player.weapon.name==='SHOTGUN') this.hudWeapon.classList.add('shotgun');
      else if(this.player.weapon.name==='RAIO') this.hudWeapon.classList.add('raio');
      else if(this.player.weapon.name==='CARREGADA') this.hudWeapon.classList.add('carregada');
      else if(this.player.weapon.name==='BAZUCA') this.hudWeapon.classList.add('bazuca');
      else if(this.player.weapon.name==='ESPADA') this.hudWeapon.classList.add('espada');
      else if(this.player.weapon.name==='LUVA') this.hudWeapon.classList.add('luva');
      else if(this.player.weapon.name==='MOTOSSERRA') this.hudWeapon.classList.add('motosserra');
      else if(this.player.weapon.name==='BASTAO') this.hudWeapon.classList.add('bastao');
      else if(this.player.weapon.name==='RAIO_MATEMATICO') this.hudWeapon.classList.add('raio_matematico');

      if(this.player.hasFlameTrail) this.hudWeapon.classList.add('has-flame');
    }
    // ===== HUD Especial (E) - barra + círculo de cooldown + nome habilidade dinâmica =====
    if(this.specialHud){
      const sp = this.player.equippedSpecial;
      if(!sp){
        this.specialHud.style.display='none';
      } else {
        this.specialHud.style.display='flex';
        // nome e ícone - para Flecha Stand mostra habilidade sorteada dinamicamente
        if(this.specialName){
          if(sp.id==='flecha_stand'){
            const abilName = sp.currentAbility ? sp.currentAbility.name : 'Aleatória';
            this.specialName.textContent = `${sp.name} › ${abilName}`;
            this.specialName.title = sp.currentAbility ? sp.currentAbility.desc : 'Pressione E: sorteia Lentidão / Aliado / Paralisia';
          } else {
            this.specialName.textContent = sp.name;
            this.specialName.title = sp.description||'';
          }
        }
        if(this.specialIcon){
          this.specialIcon.textContent = sp.icon;
          // Corrige bug de ícone: 67 precisa fonte menor e centralizado, emojis precisam sans-serif
          if(sp.icon==='67'){
            this.specialIcon.classList.add('is-67');
            this.specialIcon.style.fontFamily="'Press Start 2P', monospace";
            this.specialIcon.style.fontSize='10px';
          } else {
            this.specialIcon.classList.remove('is-67');
            this.specialIcon.style.fontFamily='';
            this.specialIcon.style.fontSize='13px';
          }
          // Garante cor do ícone conforme especial para melhor contraste
          this.specialIcon.style.color = sp.id==='farmar_aura' ? '#fff' : '#fff';
        }
        // status texto: "Pronto!" ou "Cooldown: 14s" ou "Ativo: 3s" + habilidade quando Flecha
        let status = sp.getStatusText();
        if(sp.id==='flecha_stand' && sp.currentAbility){
          // Ex: "Habilidade: Lentidão em Massa | Cooldown: 7s"
          if(sp.isOnCooldown()) status=`Habilidade: ${sp.currentAbility.name} | Cooldown: ${sp.getRemainingSeconds()}s`;
          else if(sp.isActive) status=`Habilidade: ${sp.currentAbility.name} | Ativo: ${Math.ceil(sp.durationRemaining/1000)}s`;
          else status=`Habilidade: ${sp.currentAbility.name} | Pronto!`;
        } else if(sp.id==='flecha_stand'){
          status += ' | Habilidade: Aleatória';
        }
        if(this.specialStatus) this.specialStatus.textContent = status;
        // classe visual
        this.specialHud.classList.remove('cooldown','ready','active');
        let pct = 0; // 0..100 para barra
        let circleOffset = 0;
        const circ = 2*Math.PI*16; // ~100.53
        if(sp.isActive){
          this.specialHud.classList.add('active');
          pct = sp.getDurationPercent()*100;
          // círculo mostra tempo restante de duração (diminui)
          circleOffset = circ * (1 - pct/100);
          if(this.specialFill){
            this.specialFill.style.width = pct+'%';
          }
        } else if(sp.isOnCooldown()){
          this.specialHud.classList.add('cooldown');
          pct = sp.getCooldownPercent()*100;
          // barra mostra cooldown restante (100 => cheio, 0 => zerado)
          // Queremos barra cheia = cooldown cheio, vazia = pronto
          // Então usamos pct direto
          circleOffset = circ * (pct/100);
          if(this.specialFill){
            this.specialFill.style.width = pct+'%';
          }
        } else {
          this.specialHud.classList.add('ready');
          pct = 100;
          circleOffset = 0;
          if(this.specialFill) this.specialFill.style.width='100%';
        }
        if(this.specialCircle){
          this.specialCircle.style.strokeDasharray = circ;
          this.specialCircle.style.strokeDashoffset = circleOffset;
          this.specialCircle.style.stroke = sp.color || '#ffcc00';
        }
        // Corrige barra fill cor conforme especial (para farmar aura rosa)
        if(this.specialFill){
          this.specialFill.style.background = sp.color || '#ffcc00';
        }
      }
    }
  }

  draw(){
    const ctx=this.ctx;
    let _saved=false;
    try{
    try{ ctx.save(); _saved=true; }catch(e){}
    try{ if(this.shake>0){ const sx=(Math.random()-0.5)*(this.shake/15), sy=(Math.random()-0.5)*(this.shake/15); ctx.translate(sx,sy); } }catch(e){}
    const theme = FLOOR_THEMES[this.floor] || FLOOR_THEMES[1];
    try{ ctx.fillStyle=theme.bg; ctx.fillRect(0,0,CANVAS_W,CANVAS_H); }catch(e){}
    if((this.state==='PLAYING' || this.state==='PAUSED') && this.currentRoom && this.player){
      try{ this.currentRoom.draw(ctx, true); }catch(e){ console.error('Room draw error', e); try{ ctx.fillStyle=theme.bg; ctx.fillRect(0,0,CANVAS_W,CANVAS_H); }catch(_){} }
      try{ for(const b of this.bullets) b.draw(ctx); }catch(e){ console.error('Bullet draw error', e); }
      try{ for(const lb of (this.lazerBeams||[])) lb.draw(ctx); }catch(e){ console.error('LazerBeam draw error', e); }
      try{ for(const m of this.meleeSwings) m.draw(ctx); }catch(e){ console.error('Melee draw error', e); }
      try{ for(const f of this.fists) f.draw(ctx); }catch(e){ console.error('Fist draw error', e); }
      try{ for(const bp of (this.bastaoProjectiles||[])) bp.draw(ctx); }catch(e){ console.error('Bastao draw error', e); }
      try{ for(const al of this.allies) al.draw(ctx); }catch(e){ console.error('Ally draw error', e); }
      try{ for(const cat of (this.gatoAntivirus||[])) cat.draw(ctx); }catch(e){ console.error('Gato draw error', e); }
      try{ for(const pc of (this.oliPieces||[])) pc.draw(ctx); }catch(e){ console.error('Oli piece draw error', e); }
      try{ for(const pw of (this.oliPawns||[])) pw.draw(ctx); }catch(e){ console.error('Oli pawn draw error', e); }
      try{
        if(isNaN(this.player.x) || isNaN(this.player.y)){
          console.warn('Player NaN em draw, corrigido');
          this.player.x = CANVAS_W/2; this.player.y = CANVAS_H/2;
        }
        this.player.draw(ctx);
      }catch(e){
        console.error('Player draw error', e);
        try{ ctx.fillStyle='#ff3b30'; ctx.fillRect((this.player.x||CANVAS_W/2)-12, (this.player.y||CANVAS_H/2)-12, 24,24); }catch(_){}
      }
      // MOTOSSERRA ÁREA: quadrado/retângulo na frente quando segura (tremendo)
      try{
        if(this.motosserraZone && this.motosserraZone.active && this.player.weapon && this.player.weapon.isMotosserra){
          const z = this.motosserraZone;
          const areaW = z.w, areaH = z.h;
          const cx = z.cx, cy = z.cy;
          const angle = z.angle || 0;
          const isPochita = !!this.player.weapon.hasPochita;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(angle);
          const trem = this.player.motosserraActive ? (Math.random()-0.5)*MOTOSSERRA_VIBRATE_AMP : 0;
          ctx.translate(trem, trem*0.62);
          // fundo área afiado - sutil e preciso
          ctx.fillStyle = isPochita ? 'rgba(255,180,60,0.14)' : 'rgba(255,42,26,0.12)';
          ctx.fillRect(-areaW/2, -areaH/2, areaW, areaH);
          // borda afinada pulsante
          const pulse = 0.5 + Math.sin(Date.now()*0.016)*0.32;
          ctx.strokeStyle = isPochita ? `rgba(255,180,60,${0.52+pulse*0.24})` : `rgba(255,30,10,${0.48+pulse*0.22})`;
          ctx.lineWidth = 1.6; // afinado: mais fino
          ctx.setLineDash([6,4]);
          ctx.strokeRect(-areaW/2, -areaH/2, areaW, areaH);
          ctx.setLineDash([]);
          // linha central de mira afiada
          ctx.strokeStyle = isPochita ? 'rgba(255,220,120,0.32)' : 'rgba(255,255,255,0.22)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3,6]);
          ctx.beginPath(); ctx.moveTo(-areaW/2+6, 0); ctx.lineTo(areaW/2-4, 0); ctx.stroke();
          ctx.setLineDash([]);
          // dentes afiados apenas nas laterais longas (mais nítidos)
          ctx.strokeStyle = isPochita ? 'rgba(255,220,120,0.58)' : 'rgba(255,255,255,0.38)';
          ctx.lineWidth = 0.9;
          for(let i=0;i< areaW; i+=10){
            ctx.beginPath(); ctx.moveTo(-areaW/2 + i, -areaH/2); ctx.lineTo(-areaW/2 + i + 3, -areaH/2 -3); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-areaW/2 + i, areaH/2); ctx.lineTo(-areaW/2 + i + 3, areaH/2 +3); ctx.stroke();
          }
          // serra central girando dentro da área
          ctx.fillStyle = isPochita ? '#ffb347' : '#ff3b30';
          ctx.beginPath(); ctx.arc(0,0, 7, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth=1.2; ctx.stroke();
          const spin = Date.now()*0.013 * (isPochita?1.35:1);
          for(let i=0;i<6;i++){
            const ang = spin + (i/6)*Math.PI*2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(ang)*3.2, Math.sin(ang)*3.2);
            ctx.lineTo(Math.cos(ang)*8.2, Math.sin(ang)*8.2);
            ctx.strokeStyle = isPochita ? '#ff6b35' : '#ff2a1a';
            ctx.lineWidth=1.3;
            ctx.stroke();
          }
          ctx.fillStyle='#1a1a1a'; ctx.beginPath(); ctx.arc(0,0, 2.2, 0, Math.PI*2); ctx.fill();
          // Pochita serras laterais dentro da área
          if(isPochita){
            for(const side of [-1,1]){
              const sx = side * areaW*0.28;
              ctx.save(); ctx.translate(sx, 0); ctx.rotate(-spin*0.9);
              ctx.fillStyle='rgba(255,180,60,0.96)'; ctx.beginPath(); ctx.arc(0,0, 4.8, 0, Math.PI*2); ctx.fill();
              ctx.strokeStyle='#ff3b30'; ctx.lineWidth=1.1;
              for(let i=0;i<5;i++){ const ang2=(i/5)*Math.PI*2; ctx.beginPath(); ctx.moveTo(Math.cos(ang2)*2.2, Math.sin(ang2)*2.2); ctx.lineTo(Math.cos(ang2)*5.8, Math.sin(ang2)*5.8); ctx.stroke(); }
              ctx.fillStyle='#1a1a1a'; ctx.beginPath(); ctx.arc(0,0, 1.6, 0, Math.PI*2); ctx.fill();
              ctx.restore();
            }
          }
          ctx.restore();
          // glow externo quando tem carga
          if(this.player.motosserraCharge>0){
            const chargePct = this.player.getMotosserraChargePct();
            ctx.fillStyle = isPochita ? `rgba(255,180,60,${0.10+chargePct*0.12})` : `rgba(255,42,26,${0.08+chargePct*0.10})`;
            ctx.beginPath(); ctx.arc(cx, cy, Math.max(areaW,areaH)*0.68, 0, Math.PI*2); ctx.fill();
          }
        }
      }catch(e){ console.error('Motosserra zone draw error', e); }
      for(const p of this.particles) p.draw(ctx);
      // HUD faixa superior - Bone Hearts no final
      ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(0,0, CANVAS_W, 36);
      ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.beginPath(); ctx.moveTo(0,36); ctx.lineTo(CANVAS_W,36); ctx.stroke();
      drawHealth(ctx, 12, 7, this.player.hp, this.player.maxHp, this.player.boneHearts|0);
      const dashPct = this.player.dashCooldown<=0 ? 1 : 1 - (this.player.dashCooldown / DASH_COOLDOWN);
      ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(CANVAS_W - 132, 10, 110, 14);
      ctx.fillStyle='rgba(255,255,255,0.15)'; ctx.fillRect(CANVAS_W -130, 12, 106, 10);
      ctx.fillStyle = this.player.dashCooldown<=0 ? '#00d9ff' : '#666'; ctx.fillRect(CANVAS_W -130, 12, 106*dashPct, 10);
      ctx.fillStyle='#fff'; ctx.font='7px "Press Start 2P"'; ctx.textAlign='center'; ctx.fillText(this.player.dashCooldown<=0?'DASH PRONTO':'DASH...', CANVAS_W -77, 20); ctx.textAlign='left';
      // info arma no canvas (canto levemente) + personagem
      const wn=this.player.weapon.name;
      let wLabel = wn==='SHOTGUN' ? 'SHOTGUN [5x]' : wn==='RAIO' ? 'RAIO ⚡ [pierce]' : wn==='RAIO_MATEMATICO' ? 'LAZER CODIFICADO [Brimstone]' : wn==='CARREGADA' ? 'CARREGADA [carga]' : wn==='BAZUCA' ? 'BAZUCA 💥 [área]' : wn==='METRALHADORA' ? 'METRALHADORA [temp]' : wn==='ESPADA' ? 'ESPADA ⚔️ [combo+onda]' : wn==='LUVA' ? 'LUVA 🥊 x2 [dual]' : wn==='MOTOSSERRA' ? 'MOTOSSERRA 🪚 [curto reto + cura]' : wn==='BASTAO' ? 'BASTÃO 🏏 [gira/retorna]' : 'NORMAL';
      let wColor = wn==='SHOTGUN' ? 'rgba(255,140,66,0.9)' : wn==='RAIO' ? 'rgba(0,229,255,0.95)' : wn==='RAIO_MATEMATICO' ? 'rgba(184,255,251,0.96)' : wn==='CARREGADA' ? 'rgba(167,139,250,0.95)' : wn==='BAZUCA' ? 'rgba(255,59,48,0.95)' : wn==='METRALHADORA' ? 'rgba(255,59,48,0.95)' : wn==='ESPADA' ? 'rgba(220,220,230,0.95)' : wn==='LUVA' ? 'rgba(255,60,60,0.95)' : wn==='MOTOSSERRA' ? 'rgba(255,42,26,0.96)' : wn==='BASTAO' ? 'rgba(250,204,21,0.95)' : 'rgba(255,235,59,0.85)';
      // nome do personagem removido em cima durante o jogo (HUD)
      if(this.player.characterId){
        if(this.player.characterId==='jg' && !this.player.hasBastao) wLabel += ' • SEM BASTÃO';
        else if(this.player.characterId==='jl') wLabel += ' • 67';
      }
      ctx.fillStyle=wColor;
      if(wn==='LUVA'){
        ctx.font='6px sans-serif';
      } else {
        ctx.font='6px "Press Start 2P"';
      }
      ctx.fillText(wLabel, 108, 28);
      // mostra barra carga mini no canvas se carregada e carregando
      if(wn==='CARREGADA' && this.player.isCharging){
        const prog = this.player.getChargeProgress();
        ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(108, 30, 60, 5);
        ctx.fillStyle = prog>0.85 ? '#ffffff' : prog>0.45 ? '#a78bfa' : '#7c3aed';
        ctx.fillRect(109, 31, 58*prog, 3);
      }
      if(wn==='ESPADA' && this.player.isSwordCharging){
        const prog=this.player.getSwordChargeProgress();
        ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(108,30,60,5);
        ctx.fillStyle= prog>0.92 ? '#ffffff' : prog>0.5 ? '#e8e8e8' : '#a0a0a0';
        ctx.fillRect(109,31,58*prog,3);
        if(prog>=0.99){ ctx.fillStyle='rgba(255,215,0,0.92)'; ctx.font='5px monospace'; ctx.textAlign='left'; ctx.fillText('PESADO PRONTO!',108,38); }
        else if(prog>0.5){ ctx.fillStyle='rgba(255,255,255,0.72)'; ctx.font='4px monospace'; ctx.textAlign='left'; ctx.fillText('carregando pesado...',108,38); }
      }
      // MOTOSSERRA - barra cura curta reta
      if(wn==='MOTOSSERRA'){
        const pct=this.player.getMotosserraChargePct();
        ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(108,30,60,5);
        ctx.fillStyle= pct>=1 ? '#ffffff' : pct>0.75 ? '#4ade80' : pct>0.4 ? '#ff8c42' : '#ff2a1a';
        ctx.fillRect(109,31,58*pct,3);
        if(pct>=0.99){ ctx.fillStyle='rgba(74,222,128,0.96)'; ctx.font='5px monospace'; ctx.textAlign='left'; ctx.fillText('♥ CURA PRONTA!',108,38); }
        else if(pct>0.02){ ctx.fillStyle='rgba(255,255,255,0.78)'; ctx.font='4px monospace'; ctx.textAlign='left'; ctx.fillText(`SERRA ${Math.round(pct*100)}%`,108,38); }
        if(this.player.weapon.hasPochita){
          ctx.fillStyle='rgba(255,204,102,0.90)'; ctx.font='4px monospace'; ctx.textAlign='left'; ctx.fillText('POCHITA x3 RETO',108,44);
        } else {
          ctx.fillStyle='rgba(255,255,255,0.62)'; ctx.font='4px monospace'; ctx.textAlign='left'; ctx.fillText('CURTO RETO',108,44);
        }
      }
      // Dev Raio Matemático - barra carga 100% + sobremesa mini indicadores no canvas
      if(wn==='RAIO_MATEMATICO' && this.player.isRayMatematicoCharging){
        const prog=this.player.getRayMatematicoProgress();
        ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(108,30,60,5);
        ctx.fillStyle= prog>=0.99 ? '#ffffff' : prog>0.60 ? '#7af2ff' : '#1a8fb3';
        ctx.fillRect(109,31,58*prog,3);
        // ticks 10% no canvas
        ctx.fillStyle='rgba(255,255,255,0.45)';
        for(let i=1;i<10;i++){ const mx=109+(58*(i/10)); ctx.fillRect(mx,31,1,3); }
        if(prog>=0.99){ ctx.fillStyle='rgba(184,255,251,0.92)'; ctx.font='5px monospace'; ctx.textAlign='left'; ctx.fillText('PRONTO! SOLTE!',108,38); }
        else { ctx.fillStyle='rgba(255,255,255,0.72)'; ctx.font='4px monospace'; ctx.textAlign='left'; ctx.fillText(`LAZER ${Math.round(prog*100)}%`,108,38); }
        if(this.player.hasSobremesa()){
          const cnt=this.player.rayMatematicoFiredThresholds? this.player.rayMatematicoFiredThresholds.size:0;
          ctx.fillStyle='rgba(255,216,168,0.92)'; ctx.font='4px monospace'; ctx.textAlign='left'; ctx.fillText(`🧁 ${cnt}/10 mini`,108,44);
        }
      }
      if(wn==='LUVA' && this.player.activeFist && !this.player.activeFist.dead){
        const f=this.player.activeFist;
        const prog= f.returning? 0.5 + (1 - f.life/4200)*0.5 : (f.traveled/f.maxRange);
        ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(108,30,60,5);
        ctx.fillStyle= f.returning? '#ff8a00' : '#ff3b30';
        ctx.fillRect(109,31,58*clamp(prog,0,1),3);
        ctx.fillStyle='rgba(255,255,255,0.72)'; ctx.font='4px monospace'; ctx.textAlign='left'; ctx.fillText(f.returning?'RETORNANDO':'LANÇADO',108,38);
      }
      // JG Bastão - barra no canvas
      if(this.player.characterId==='jg'){
        if(this.player.isBastaoCharging){
          const prog=this.player.getBastaoChargeProgress();
          ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(108,30,60,5);
          ctx.fillStyle= prog>0.92 ? '#ffffff' : prog>0.5 ? '#fde68a' : '#facc15';
          ctx.fillRect(109,31,58*prog,3);
          if(prog>=0.99){ ctx.fillStyle='rgba(250,204,21,0.92)'; ctx.font='5px monospace'; ctx.textAlign='left'; ctx.fillText('ARREMESSO PRONTO!',108,38); }
          else if(prog>0.5){ ctx.fillStyle='rgba(255,255,255,0.72)'; ctx.font='4px monospace'; ctx.textAlign='left'; ctx.fillText('carregando bastão...',108,38); }
        } else if(!this.player.hasBastao && this.player.bastaoProjectile){
          const bp=this.player.bastaoProjectile;
          const prog= bp.returning? 0.5 + (1 - (dist(bp.x,bp.y,this.player.x,this.player.y)/bp.maxRange))*0.5 : (bp.traveled/bp.maxRange);
          ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(108,30,60,5);
          ctx.fillStyle= bp.returning? '#facc15' : '#fde68a';
          ctx.fillRect(109,31,58*clamp(prog,0,1),3);
          ctx.fillStyle='rgba(255,255,255,0.72)'; ctx.font='4px monospace'; ctx.textAlign='left'; ctx.fillText(bp.returning?'RETORNANDO':'LANÇADO',108,38);
        } else if(!this.player.hasBastao){
          ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(108,30,60,5);
          ctx.fillStyle='#7a6500'; ctx.fillRect(109,31,8,3);
          ctx.fillStyle='rgba(255,255,255,0.55)'; ctx.font='4px monospace'; ctx.textAlign='left'; ctx.fillText('SEM BASTÃO',108,38);
        }
      }
      // JL Farmar Aura cooldown hint no canvas quando equipado
      if(this.player.characterId==='jl' && this.player.equippedSpecial && this.player.equippedSpecial.id==='farmar_aura'){
        const sp=this.player.equippedSpecial;
        if(sp.isOnCooldown()){
          ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(108,44,60,4);
          const pct=sp.getCooldownPercent();
          ctx.fillStyle='#ff6b9d'; ctx.fillRect(109,45,58*(1-pct),2);
          ctx.fillStyle='rgba(255,255,255,0.72)'; ctx.font='4px monospace'; ctx.textAlign='left'; ctx.fillText(`67 ${sp.getRemainingSeconds()}s`,108,50);
        } else if(sp.isActive){
          ctx.fillStyle='rgba(255,107,157,0.92)'; ctx.font='5px monospace'; ctx.textAlign='left'; ctx.fillText('67 AURA ATIVA!',108,46);
        }
      }
      if(this.player.secondaryWeapon){
        const other = this.player.weapon === this.player.primaryWeapon ? this.player.secondaryWeapon.name : this.player.primaryWeapon.name;
        ctx.fillStyle='rgba(255,255,255,0.65)';
        ctx.font='5px "Press Start 2P"'; ctx.fillText(`[Q]→${other}`, 108, 34);
      } else {
        ctx.fillStyle='rgba(255,255,255,0.35)';
        ctx.font='5px "Press Start 2P"'; ctx.fillText('[Q] sem secundária', 108, 34);
      }
      if(this.player.hasFlameTrail){
        ctx.fillStyle='rgba(255,106,0,0.95)';
        ctx.font='5px "Press Start 2P"'; ctx.fillText('🔥 RASTRO', 108, 40);
      }
      // minimapa
      this.drawMinimap(ctx);
      if(this.currentRoom.isRare){
        ctx.fillStyle='rgba(255,215,0,0.95)'; ctx.font='7px "Press Start 2P"'; ctx.textAlign='center';
        ctx.fillText('★ SALA RARA ★', CANVAS_W/2, CANVAS_H - 14); ctx.textAlign='left';
      } else if(!this.currentRoom.isCleared()){
        ctx.fillStyle='rgba(255,59,48,0.9)'; ctx.font='8px "Press Start 2P"'; ctx.textAlign='center'; ctx.fillText('DERROTE OS INIMIGOS PARA ABRIR', CANVAS_W/2, CANVAS_H - 14); ctx.textAlign='left';
      } else if(this.currentRoom.exitPortal && this.currentRoom.exitPortal.active){
        ctx.fillStyle='rgba(255,204,0,0.92)'; ctx.font='7px "Press Start 2P"'; ctx.textAlign='center';
        const txt = this.floor===1 ? '⬇ ESCADA PARA FASE 2' : this.floor===2 ? '⬇ ESCADA PARA FASE 3' : '⬇ SAÍDA LIBERADA! FUJA!';
        ctx.fillText(txt, CANVAS_W/2, CANVAS_H - 14); ctx.textAlign='left';
      }
      const grad=ctx.createRadialGradient(CANVAS_W/2,CANVAS_H/2, CANVAS_W*0.4, CANVAS_W/2,CANVAS_H/2, CANVAS_W*0.9);
      grad.addColorStop(0,'rgba(0,0,0,0)'); grad.addColorStop(1, theme.vignette); ctx.fillStyle=grad; ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
      if(this.transitionCooldown>250){ ctx.fillStyle=`rgba(0,0,0,${(this.transitionCooldown-250)/150})`; ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
        if(this.floorTransitioning){
          ctx.fillStyle='#fff'; ctx.font='14px "Press Start 2P"'; ctx.textAlign='center';
          ctx.fillText(`FASE ${this.floor} → ${this.floor+1}`, CANVAS_W/2, CANVAS_H/2);
          ctx.textAlign='left';
        }
      }
    } else if(this.state==='MENU'){
      ctx.fillStyle=FLOOR_THEMES[1].floorA; ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
      ctx.fillStyle='rgba(255,59,48,0.04)'; for(let y=0;y<CANVAS_H;y+=24) for(let x=0;x<CANVAS_W;x+=24) if((x+y)%48===0) ctx.fillRect(x,y,24,24);
    }
    }catch(e){ console.error('Game draw outer error', e); }finally{ try{ if(_saved) ctx.restore(); }catch(_){} }
  }

  drawMinimap(ctx){
    // Minimapa maior em monitores grandes para hierarquia de mapa dominante
    const isLarge = typeof window !== 'undefined' && window.innerWidth >= 1280;
    const size=isLarge?13:10, gap=isLarge?3:2, pad=10, cols=5, rows=5, mapW=cols*(size+gap)-gap, mapH=rows*(size+gap)-gap;
    const ox=CANVAS_W - mapW - pad, oy=CANVAS_H - mapH - pad - 18;
    ctx.fillStyle='rgba(0,0,0,0.58)'; ctx.fillRect(ox-6, oy-6, mapW+12, mapH+12);
    ctx.strokeStyle='rgba(255,255,255,0.10)'; ctx.strokeRect(ox-6, oy-6, mapW+12, mapH+12);
    for(const r of this.rooms){
      const x=ox + r.gx*(size+gap), y=oy + r.gy*(size+gap), isCur=r===this.currentRoom, isVisited=r.visited;
      if(!isVisited){ ctx.fillStyle='rgba(255,255,255,0.04)'; ctx.fillRect(x,y,size,size); continue; }
      let col;
      if(r.isHacker) col = r.hackerDefeated ? '#4ade80' : (isCur ? '#00ff88' : '#00cc66');
      else if(r.isPartyHorde) col = r.partyHordeDefeated ? '#4ade80' : (isCur ? '#ff6b9d' : '#ff3b6b');
      else if(r.isBossStair) col = r.bossStairDefeated ? '#4ade80' : (isCur ? '#ffd700' : '#b8860b');
      else if(r.isMiniboss) col = r.isCleared() ? '#4ade80' : (isCur ? '#d946ef' : '#a21caf');
      else if(r.isRare) col = isCur ? '#ffd700' : '#d4af37';
      else if(r.isExit) col = r.isCleared() && this.isFloorCleared() ? '#ffcc00' : '#ff8c42';
      else if(isCur) col='#ffcc00';
      else if(r.isCleared()) col='#4ade80';
      else if(r.type==='treasure') col='#00d9ff';
      else col='#ff6b6b';
      if(r.isStart) col = isCur ? '#ffcc00' : '#8a6cff';
      // fase 2 cor ligeiramente mais escura
      ctx.fillStyle=col; ctx.fillRect(x,y,size,size);
      // itens indicador mini
      if(r.items.length>0 && isVisited){
        const hasHeal=r.items.some(it=>it.type.includes('heal'));
        const hasShot=r.items.some(it=>it.type==='shotgun');
        const hasRaio=r.items.some(it=>it.type==='raio');
        const hasFlame=r.items.some(it=>it.type==='flame_trail');
        const hasBoots=r.items.some(it=>it.type==='swift_boots');
        const hasSpecial=r.items.some(it=>it.isSpecialPickup);
        const hasSpecialSword=r.items.some(it=>it.isSpecialPickup && it.specialId==='espada_flamejante');
        const hasSpecialShield=r.items.some(it=>it.isSpecialPickup && it.specialId==='escudo_magico');
        const hasSpecialFlecha=r.items.some(it=>it.isSpecialPickup && it.specialId==='flecha_stand');
        const hasPowerStar=r.items.some(it=>it.isSpecialPickup && it.specialId==='power_star');
        const hasBazuca=r.items.some(it=>it.weaponType==='bazuca' || it.isBazuca);
        const hasMotosserra=r.items.some(it=>it.weaponType==='motosserra' || it.isMotosserra);
        if(hasHeal){ ctx.fillStyle='#4ade80'; ctx.fillRect(x+2,y+2,3,3); }
        if(hasShot){ ctx.fillStyle='#ff8c42'; ctx.fillRect(x+5,y+5,4,2); }
        if(hasRaio){ ctx.fillStyle='#00e5ff'; ctx.fillRect(x+2,y+6,6,2); }
        if(hasFlame){ ctx.fillStyle='#ff6a00'; ctx.fillRect(x+7,y+2,2,3); }
        if(hasBoots){ ctx.fillStyle='#00d9ff'; ctx.fillRect(x+7,y+5,2,2); }
        if(hasSpecial){ ctx.fillStyle='#ffd700'; ctx.fillRect(x+2,y+5,2,2); }
        if(hasSpecialSword){ ctx.fillStyle='#ff6a00'; ctx.fillRect(x+4,y+2,2,2); }
        if(hasSpecialShield){ ctx.fillStyle='#00e5ff'; ctx.fillRect(x+6,y+2,2,2); }
        if(hasSpecialFlecha){ ctx.fillStyle='#c084fc'; ctx.fillRect(x+2,y+7,6,2); }
        if(hasPowerStar){ ctx.fillStyle='#ffd700'; ctx.fillRect(x+2,y+2,3,3); ctx.fillStyle='#fff'; ctx.fillRect(x+3,y+3,1,1); }
        if(hasBazuca){ ctx.fillStyle='#ff3b30'; ctx.fillRect(x+4,y+6,4,2); }
        if(hasMotosserra){ ctx.fillStyle='#c0392b'; ctx.fillRect(x+5,y+2,3,3); }
      }
      if(r.isExit){
        ctx.fillStyle='rgba(0,0,0,0.9)'; ctx.fillRect(x+2,y+3,6,4);
        ctx.fillStyle='#ffcc00'; ctx.fillRect(x+3,y+4,4,2);
      }
      if(r.isRare){
        ctx.fillStyle='rgba(255,215,0,0.95)'; ctx.fillRect(x+4,y+1,2,2);
      }
      if(r.isHacker){
        ctx.fillStyle=r.hackerDefeated?'#4ade80':'#00ff88'; ctx.fillRect(x+1,y+1,8,3);
        ctx.fillStyle='rgba(0,0,0,0.85)'; ctx.font='4px monospace'; ctx.textAlign='center';
        ctx.fillText('H', x+size/2, y+4); ctx.textAlign='left';
        ctx.fillStyle='rgba(0,255,136,0.92)'; ctx.fillRect(x+2,y+6,6,1);
        if(!r.hackerDefeated && r.hackerLocked){
          ctx.fillStyle='rgba(255,0,64,0.85)'; ctx.fillRect(x+4,y+7,2,2);
        }
      }
      if(r.isPartyHorde){
        ctx.fillStyle=r.partyHordeDefeated?'#4ade80':'#ff6b9d'; ctx.fillRect(x+1,y+6,8,3);
        ctx.fillStyle='rgba(255,255,255,0.95)'; ctx.font='4px monospace'; ctx.textAlign='center';
        ctx.fillText('♪', x+size/2, y+9); ctx.textAlign='left';
        ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.fillRect(x+2,y+2,6,1);
      }
      if(r.isBossStair){
        ctx.fillStyle=r.bossStairDefeated?'#4ade80':'#ffd700'; ctx.fillRect(x+1,y+1,8,3);
        ctx.fillStyle='rgba(0,0,0,0.85)'; ctx.font='4px monospace'; ctx.textAlign='center';
        ctx.fillText('B', x+size/2, y+4); ctx.textAlign='left';
        ctx.fillStyle='rgba(255,255,255,0.92)'; ctx.fillRect(x+2,y+6,6,1);
      }
      if(r.isMiniboss){
        ctx.fillStyle=r.isCleared()?'#4ade80':'#d946ef'; ctx.fillRect(x+2,y+1,6,2);
        ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.fillRect(x+3,y+1,4,1);
      }
      ctx.fillStyle='rgba(255,255,255,0.9)';
      if(r.doors.top) ctx.fillRect(x+size/2-1, y-2, 2, 2);
      if(r.doors.bottom) ctx.fillRect(x+size/2-1, y+size, 2, 2);
      if(r.doors.left) ctx.fillRect(x-2, y+size/2-1, 2, 2);
      if(r.doors.right) ctx.fillRect(x+size, y+size/2-1, 2, 2);
      if(isCur){ ctx.strokeStyle='#fff'; ctx.lineWidth=1; ctx.strokeRect(x-1,y-1,size+2,size+2); }
    }
    ctx.fillStyle='rgba(255,255,255,0.6)'; ctx.font='6px monospace'; ctx.fillText(`MAPA F${this.floor}`, ox, oy-10);
  }

  loop(t){
    const dt=Math.min(34, t - this.lastTime || 16);
    this.lastTime=t;
    this.update(dt);
    this.draw();
    requestAnimationFrame((nt)=>this.loop(nt));
  }
}

window.addEventListener('DOMContentLoaded', ()=>{
  const game=new Game(); window.game=game;
  console.log('%cCyber Requiem v6.0 carregado!','color:#8ecae6;font-size:14px;font-weight:bold');
  console.log('Cyber Requiem • 5 Atos • Bone Heart (Coração Cinza) • Corações de cura + Shotgun | Fugitivo foge e atira');
});
