using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace OhMyLLMs;

internal sealed class GameWindow : Form
{
    private const string Host = "ohmyllms.invalid";
    private const double DefaultZoom = .67;
    private readonly WebView2 browser = new() { Dock = DockStyle.Fill, DefaultBackgroundColor = Color.FromArgb(244, 241, 231) };
    private readonly bool development;
    private readonly string? smokeDirectory;
    private readonly string dataDirectory;
    private readonly List<string> scriptErrors = [];
    private readonly Label loading = new() { Dock = DockStyle.Fill, Text = "Oh My LLMs\n正在准备花园…", TextAlign = ContentAlignment.MiddleCenter, Font = new Font("Segoe UI", 16) };
    private bool fullscreen;
    private bool fullscreenKeyHeld;
    private Rectangle normalBounds;
    private FormWindowState previousState;
    public int ExitCode { get; private set; }

    public GameWindow(bool development, string? smokeDirectory)
    {
        this.development = development;
        this.smokeDirectory = smokeDirectory;
        dataDirectory = smokeDirectory is null
            ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OhMyLLMs")
            : Path.Combine(smokeDirectory, "profile");
        Text = "Oh My LLMs";
        StartPosition = FormStartPosition.Manual;
        AutoScaleMode = AutoScaleMode.Dpi;
        BackColor = Color.FromArgb(244, 241, 231);
        Icon = Icon.ExtractAssociatedIcon(Environment.ProcessPath!);
        ClientSize = new Size(1480, 1000);
        if (smokeDirectory is not null) { Opacity = .01; ShowInTaskbar = false; }
        Controls.Add(browser);
        Controls.Add(loading);
        Shown += async (_, _) => await InitializeBrowser();
        Deactivate += async (_, _) => await PauseGame();
        Activated += async (_, _) => { if(browser.CoreWebView2 is not null) await browser.CoreWebView2.ExecuteScriptAsync("window.dispatchEvent(new Event('desktop:focus'))"); };
        Resize += async (_, _) => { if (WindowState == FormWindowState.Minimized) await PauseGame(); };
    }

    protected override bool ShowWithoutActivation => smokeDirectory is not null || base.ShowWithoutActivation;

    protected override void OnLoad(EventArgs e)
    {
        base.OnLoad(e);
        WindowPlacement.Restore(this, Path.Combine(dataDirectory, "window.json"));
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        if (smokeDirectory is null)
        {
            if (fullscreen) ToggleFullscreen();
            WindowPlacement.Save(this, Path.Combine(dataDirectory, "window.json"));
        }
        base.OnFormClosing(e);
    }

    private async Task InitializeBrowser()
    {
        try
        {
            var assets = Path.Combine(AppContext.BaseDirectory, "game");
            if (!File.Exists(Path.Combine(assets, "index.html")))
                throw new IOException("缺少 game 目录，请将应用及素材目录一起解压后运行。");
            Directory.CreateDirectory(dataDirectory);
            var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: Path.Combine(dataDirectory, "WebView2"));
            await browser.EnsureCoreWebView2Async(environment);
            var core = browser.CoreWebView2;
            core.SetVirtualHostNameToFolderMapping(Host, assets, CoreWebView2HostResourceAccessKind.DenyCors);
            var settings = core.Settings;
            settings.AreDefaultContextMenusEnabled = development;
            settings.AreDevToolsEnabled = development;
            settings.AreBrowserAcceleratorKeysEnabled = false;
            settings.IsZoomControlEnabled = false;
            settings.IsPinchZoomEnabled = false;
            settings.IsStatusBarEnabled = false;
            settings.IsSwipeNavigationEnabled = false;
            settings.AreHostObjectsAllowed = false;
            settings.IsWebMessageEnabled = false;
            core.PermissionRequested += (_, e) => e.State = CoreWebView2PermissionState.Deny;
            core.NewWindowRequested += (_, e) => e.Handled = true;
            core.DownloadStarting += (_, e) => e.Cancel = true;
            core.NavigationStarting += (_, e) =>
            {
                if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri) || uri.Scheme != "https" || uri.Host != Host) e.Cancel = true;
            };
            core.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
            core.WebResourceRequested += (_, e) =>
            {
                if (Uri.TryCreate(e.Request.Uri, UriKind.Absolute, out var uri) && uri.Scheme is "http" or "https" && uri.Host != Host)
                    e.Response = environment.CreateWebResourceResponse(null, 403, "Offline application", "Content-Type: text/plain");
            };
            await core.AddScriptToExecuteOnDocumentCreatedAsync("""
                (() => {
                  const configure = () => {
                    if (!document.documentElement) return false;
                    document.documentElement.dataset.desktop = 'true';
                    document.documentElement.style.setProperty('--ui-scale', '1');
                    return true;
                  };
                  if (!configure()) {
                    const observer = new MutationObserver(() => { if (configure()) observer.disconnect(); });
                    observer.observe(document, { childList: true, subtree: true });
                  }
                  document.addEventListener('DOMContentLoaded', () => window.dispatchEvent(new Event('resize')), { once: true });
                })();
                """);
            browser.ZoomFactor = DefaultZoom;
            browser.ZoomFactorChanged += (_, _) => { if (Math.Abs(browser.ZoomFactor - DefaultZoom) > .001) browser.ZoomFactor = DefaultZoom; };
            browser.KeyUp += (_, e) => { if (e.KeyCode == Keys.F11) fullscreenKeyHeld = false; };
            browser.KeyDown += (_, e) =>
            {
                if (e.KeyCode == Keys.F11)
                {
                    e.Handled = true;
                    e.SuppressKeyPress = true;
                    if (!fullscreenKeyHeld) { fullscreenKeyHeld = true; BeginInvoke(ToggleFullscreen); }
                }
                else if (e.KeyCode == Keys.Escape && fullscreen)
                {
                    BeginInvoke(async () =>
                    {
                        if (await core.ExecuteScriptAsync("!!document.querySelector('dialog[open]')") == "false") ToggleFullscreen();
                    });
                }
            };
            if (smokeDirectory is not null)
            {
                await core.CallDevToolsProtocolMethodAsync("Runtime.enable", "{}");
                core.GetDevToolsProtocolEventReceiver("Runtime.exceptionThrown").DevToolsProtocolEventReceived += (_, e) => scriptErrors.Add(e.ParameterObjectAsJson);
            }
            core.NavigationCompleted += async (_, e) =>
            {
                if (!e.IsSuccess) { await ReportFailure(new IOException($"无法加载本地游戏：{e.WebErrorStatus}")); return; }
                loading.Visible = false;
                if (smokeDirectory is null) browser.Focus();
                else await RunSmokeTest();
            };
            core.Navigate($"https://{Host}/index.html");
        }
        catch (Exception error) { await ReportFailure(error); }
    }

    private async Task PauseGame()
    {
        if (browser.CoreWebView2 is null || browser.IsDisposed) return;
        try { await browser.CoreWebView2.ExecuteScriptAsync("window.dispatchEvent(new Event('desktop:pause'))"); }
        catch (Exception error) when (error is InvalidOperationException or System.Runtime.InteropServices.COMException) { }
    }

    private void ToggleFullscreen()
    {
        if (!fullscreen)
        {
            normalBounds = Bounds;
            previousState = WindowState;
            WindowState = FormWindowState.Normal;
            FormBorderStyle = FormBorderStyle.None;
            Bounds = Screen.FromHandle(Handle).Bounds;
            fullscreen = true;
        }
        else
        {
            FormBorderStyle = FormBorderStyle.Sizable;
            Bounds = normalBounds;
            WindowState = previousState;
            fullscreen = false;
        }
    }

    private async Task ReportFailure(Exception error)
    {
        ExitCode = 1;
        if (smokeDirectory is not null)
        {
            Directory.CreateDirectory(smokeDirectory);
            await File.WriteAllTextAsync(Path.Combine(smokeDirectory, "error.txt"), error.ToString());
            Close();
            return;
        }
        loading.Text = error is WebView2RuntimeNotFoundException
            ? "Oh My LLMs\n需要 Microsoft Edge WebView2 Runtime，请安装后重新打开应用。"
            : $"Oh My LLMs\n启动失败：{error.Message}";
        loading.Visible = true;
    }

    private async Task RunSmokeTest()
    {
        try
        {
            var core = browser.CoreWebView2;
            var ready = false;
            for (var i = 0; i < 300; i++)
            {
                if (await core.ExecuteScriptAsync("!!document.querySelector('#stage-start:not([hidden])')") == "true") { ready = true; break; }
                await Task.Delay(100);
            }
            if (!ready) throw new IOException("Game artwork did not finish loading within 30 seconds.");
            Directory.CreateDirectory(smokeDirectory!);
            var startup = await core.ExecuteScriptAsync("""
                (() => {
                  const app = document.querySelector('#app').getBoundingClientRect();
                  const canvas = document.querySelector('#garden').getBoundingClientRect();
                  window.__desktopTestCanvas = document.querySelector('#garden');
                  return { origin: location.origin, desktop: document.documentElement.dataset.desktop,
                    density: getComputedStyle(document.documentElement).getPropertyValue('--ui-scale').trim(),
                    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
                    app: { width: app.width, height: app.height },
                    canvas: { width: canvas.width, height: canvas.height,
                      bitmapWidth: window.__desktopTestCanvas.width, bitmapHeight: window.__desktopTestCanvas.height },
                    sharp: window.__desktopTestCanvas.width === Math.round(canvas.width * devicePixelRatio)
                      && window.__desktopTestCanvas.height === Math.round(canvas.height * devicePixelRatio),
                    cards: document.querySelectorAll('[data-model]').length,
                    tokens: document.querySelector('#token-count').textContent, heading: document.querySelector('.garden-brand strong').textContent,
                    fits: app.right <= innerWidth + 2 && app.bottom <= innerHeight + 2,
                    warnings: [...document.querySelectorAll('.toast.warning')].map(e => e.textContent) };
                })()
                """);
            using var startupJson = JsonDocument.Parse(startup);
            var state = startupJson.RootElement;
            if (state.GetProperty("cards").GetInt32() != 11 || !state.GetProperty("fits").GetBoolean()
                || state.GetProperty("density").GetString() != "1" || state.GetProperty("desktop").GetString() != "true"
                || !state.GetProperty("sharp").GetBoolean() || state.GetProperty("warnings").GetArrayLength() != 0)
                throw new IOException($"Desktop layout failed validation: {startup}");

            await core.ExecuteScriptAsync("document.querySelector('#deck-dex').click()");
            var dex = await core.ExecuteScriptAsync("document.querySelector('#modal').open && document.querySelector('#garden') === window.__desktopTestCanvas && document.querySelectorAll('#modal .dex-card').length === 11 && document.querySelectorAll('#modal .dex-stats').length === 11 && document.querySelectorAll('#modal .dex-hp-ranks span').length === 33");
            if (dex != "true") throw new IOException("Field guide modal did not preserve the desktop battlefield.");
            await core.ExecuteScriptAsync("document.querySelector('#modal').scrollTop = document.querySelector('#modal').scrollHeight");
            await using (var output = File.Create(Path.Combine(smokeDirectory!, "models.png")))
                await core.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, output);
            var stableDex = await core.ExecuteScriptAsync("""
                (() => {
                  const modal = document.querySelector('#modal');
                  const before = modal.getBoundingClientRect();
                  const fixedCards = () => {
                    const cards=[...modal.querySelectorAll('.dex-card')];
                    const fits=cards.every(card=> {
                      const body=card.querySelector('.dex-desc'),style=getComputedStyle(body);
                      return Math.abs(parseFloat(getComputedStyle(card).height)-480)<1
                        &&style.overflowY==='auto'&&style.scrollbarWidth==='none'
                        &&body.getBoundingClientRect().bottom<=card.getBoundingClientRect().bottom+1
                        &&body.offsetWidth===body.clientWidth&&body.tabIndex===0;
                    });
                    const long=cards.find(card=> {const b=card.querySelector('.dex-desc');return b.scrollHeight>b.clientHeight+20;});
                    if(!long)return false;
                    const body=long.querySelector('.dex-desc'),heading=long.querySelector('h2');
                    const top=heading.getBoundingClientRect().top,outerScroll=modal.scrollTop;
                    body.scrollTop=body.scrollHeight;
                    const scrolls=body.scrollTop>0&&Math.abs(heading.getBoundingClientRect().top-top)<1&&modal.scrollTop===outerScroll;
                    body.scrollTop=0;return fits&&scrolls;
                  };
                  modal.querySelector('[data-dex="enemies"]').click();
                  const after = modal.getBoundingClientRect();
                  const stable = ['width','height','x','y'].every(key => Math.abs(before[key]-after[key]) < 1);
                  const enemies = modal.querySelectorAll('.dex-card').length === 21 && modal.querySelectorAll('.dex-stats dd').length === 63
                    && modal.querySelectorAll('.boss-card').length === 5
                    && modal.querySelectorAll('.skill-chip,.skill-chips,.skill-name').length === 0
                    && [...modal.querySelectorAll('.dex-card')].every(card => {
                      const paragraphs=[...card.querySelectorAll('.dex-desc .dex-skill')];
                      return paragraphs.length>0&&paragraphs.every(p=>p.querySelector('.dex-skill-title')
                        &&p.lastChild.nodeType===Node.TEXT_NODE&&p.lastChild.textContent.trim().length>0);
                    })
                    && [...modal.querySelectorAll('.dex-card')].find(card=>card.querySelector('h2').textContent==='Donald John Trump')
                      ?.querySelectorAll('.dex-desc .dex-skill').length === 6
                    && [...modal.querySelectorAll('.dex-card')].find(card=>card.querySelector('h2').textContent==='Elon Musk Super')
                      ?.querySelectorAll('.dex-desc .dex-skill').length === 11 && fixedCards();
                  modal.querySelector('[data-dex="models"]').click();
                  const restored = modal.getBoundingClientRect();
                  const models=[...modal.querySelectorAll('.dex-card')].every(card=>card.querySelector('.dex-desc .dex-skill-title'))
                    &&!modal.querySelector('.skill-name,.skill-chip')&&fixedCards();
                  return stable && enemies && models && ['width','height','x','y'].every(key => Math.abs(before[key]-restored[key]) < 1);
                })()
                """);
            if (stableDex != "true") throw new IOException("Field guide tabs changed the modal size or position.");
            await core.ExecuteScriptAsync("document.querySelector('#modal [data-dex=\"enemies\"]').click()");
            var portraitsReady = false;
            for (var i = 0; i < 50; i++)
            {
                var portraits = await core.ExecuteScriptAsync("(() => { const images = [...document.querySelectorAll('#modal .enemy-portrait')]; return images.length === 15 && images.every(image => image.complete && image.naturalWidth > 0) && document.querySelector('#modal [data-dex=\"enemies\"]').textContent.includes('资本来客'); })()");
                if (portraits == "true") { portraitsReady = true; break; }
                await Task.Delay(100);
            }
            if (!portraitsReady) throw new IOException("Independent enemy guide portraits or title failed validation.");
            await core.ExecuteScriptAsync("document.querySelector('#modal').scrollTop = document.querySelector('#modal').scrollHeight");
            await using (var output = File.Create(Path.Combine(smokeDirectory!, "enemies.png")))
                await core.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, output);
            await core.ExecuteScriptAsync("document.querySelector('#modal .modal-close').click()");
            await core.ExecuteScriptAsync("document.querySelector('.settings-open').click()");
            var settings = await core.ExecuteScriptAsync("document.querySelector('#modal').open && document.querySelectorAll('#modal .settings-lang').length === 3");
            if (settings != "true") throw new IOException("Desktop settings failed to open.");
            await core.ExecuteScriptAsync("document.querySelector('#modal .modal-close').click()");
            await core.ExecuteScriptAsync("document.querySelector('#score-open').click()");
            var scorePanel = await core.ExecuteScriptAsync("document.querySelector('#modal').open && !!document.querySelector('.score-table') && document.querySelector('#score-count').textContent === '0'");
            if (scorePanel != "true") throw new IOException("Endless score panel did not open.");
            await core.ExecuteScriptAsync("document.querySelector('#modal .modal-close').click()");

            ToggleFullscreen();
            await Task.Delay(200);
            var fullscreenWorked = FormBorderStyle == FormBorderStyle.None && Bounds == Screen.FromHandle(Handle).Bounds;
            ToggleFullscreen();
            await Task.Delay(300);
            if (!fullscreenWorked) throw new IOException("Native fullscreen validation failed.");
            await using (var output = File.Create(Path.Combine(smokeDirectory!, "desktop.png")))
                await core.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, output);

            var originalBounds = Bounds;
            var placementPath = Path.Combine(smokeDirectory!, "window-test.json");
            WindowPlacement.Save(this, placementPath);
            ClientSize = new Size(MinimumSize.Width + 80, MinimumSize.Height + 40);
            await Task.Delay(300);
            var resizeFits = await core.ExecuteScriptAsync("(() => { const r = document.querySelector('#app').getBoundingClientRect(); return r.right <= innerWidth + 2 && r.bottom <= innerHeight + 2 && document.querySelector('#garden').getBoundingClientRect().width > 0; })()");
            WindowPlacement.Restore(this, placementPath);
            await Task.Delay(300);
            var placementRestored = Bounds == originalBounds;
            if (resizeFits != "true" || !placementRestored) throw new IOException("Window resize or placement persistence failed.");

            await core.ExecuteScriptAsync("""
                (() => {
                  document.querySelector('[data-model="kimi"]').click();
                  const canvas = document.querySelector('#garden'), r = canvas.getBoundingClientRect();
                  canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0,
                    clientX: r.left + 250 / 1120 * r.width, clientY: r.top + 152 / 650 * r.height }));
                })()
                """);
            var deployment = await core.ExecuteScriptAsync("document.querySelector('#token-count').textContent === '125'");
            if (deployment != "true") throw new IOException("Pointer deployment failed at native zoom.");
            await core.ExecuteScriptAsync("document.querySelector('#stage-start').click()");
            await PauseGame();
            var focusPause = await core.ExecuteScriptAsync("!document.querySelector('#stage-overlay').hidden");
            if (focusPause != "true") throw new IOException("Native focus-loss pause failed.");
            // Exercise the shipped renderer and every new role using real local
            // artwork. A separate canvas keeps the player's battle untouched.
            await core.ExecuteScriptAsync("""
                (async () => {
                  try {
                    const [{GardenGame},{GardenRenderer,loadArtwork}] = await Promise.all([
                      import('./engine.js'),import('./renderer.js')]);
                    const art = await loadArtwork();
                    const canvas = document.createElement('canvas');
                    canvas.id = 'enemy-smoke-canvas';
                    canvas.style.cssText = 'position:absolute;left:0;top:-7.75862%;width:100%;height:112.06897%;z-index:11';
                    document.querySelector('#canvas-wrap').append(canvas);
                    const game = new GardenGame({starter:false,seed:42,eggs:false});
                    game.tokens = 99999;game.wave = 6;game.tickTime = 1.5;
                    for(let row=0;row<5;row++) {
                      const model=row===0?'doubao':row===2?'mimo':'chatgpt';
                      for(let n=0;n<7;n++)game.plant(model,row,1);
                      game.plant('qwen',row,4);
                    }
                    for(const [type,row,x] of [['runner',0,800],['medic',0,950],['ipo',1,850],
                      ['bulwark',2,820],['banner',2,980],['overlord',3,850],['pony',4,780],['jack',4,970]]) {
                      const enemy=game.spawnEnemy(type,row);enemy.x=x;
                      if(type==='overlord'){enemy.hp=enemy.maxHp*.45;game.updateEnemyKit(enemy);}
                      if(type==='bulwark')enemy.slow=2;
                      if(type==='runner')enemy.burn={remaining:2,tick:.5};
                      if(type==='pony')game.updatePonyRaid(enemy,3.6);
                    }
                    new GardenRenderer(canvas,art).draw(game,0);
                    const probe=new GardenGame({starter:false,seed:123});
                    for(let n=0;n<100;n++){probe.queue=[];probe.beginWave();}
                    const victim=probe.spawnEnemy('pony',0);probe.damageEnemy(victim,999999);
                    window.__raidArt={GardenGame,GardenRenderer,art};
                    window.__enemySmokeState = {ok:true,variants:game.enemies.length,bosses:game.enemies.filter(e=>e.boss).length,endlessWave:probe.wave,score:probe.score};
                  } catch(error) {window.__enemySmokeState={ok:false,error:String(error)};}
                })()
                """);
            string enemyRendering = "null";
            for (var i = 0; i < 100; i++)
            {
                enemyRendering = await core.ExecuteScriptAsync("window.__enemySmokeState || null");
                if (enemyRendering != "null") break;
                await Task.Delay(100);
            }
            using var enemyJson = JsonDocument.Parse(enemyRendering);
            if (enemyRendering == "null" || !enemyJson.RootElement.GetProperty("ok").GetBoolean()
                || enemyJson.RootElement.GetProperty("bosses").GetInt32() != 2
                || enemyJson.RootElement.GetProperty("endlessWave").GetInt32() != 100
                || enemyJson.RootElement.GetProperty("score").GetInt32() != 240)
                throw new IOException($"Enemy rendering validation failed: {enemyRendering}");
            await using (var output = File.Create(Path.Combine(smokeDirectory!, "bosses.png")))
                await core.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, output);
            var raidWarning = await core.ExecuteScriptAsync("""
                (() => {
                  const {GardenGame,GardenRenderer,art}=window.__raidArt;
                  const game=new GardenGame({starter:false,seed:42,eggs:false});game.tokens=9999;
                  const unit=game.plant('qwen',2,4).unit;game.start();game.nextWaveTimer=999;
                  const raider=game.spawnEnemy('pony',0),renderer=new GardenRenderer(document.querySelector('#enemy-smoke-canvas'),art);
                  window.__raidSmoke={game,unit,raider,renderer};renderer.draw(game,0);
                  return raider.raid.phase==='warning' && raider.raid.remaining===3 && raider.damage===0;
                })()
                """);
            await using (var output = File.Create(Path.Combine(smokeDirectory!, "pony-warning.png")))
                await core.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, output);
            var raidLanded = await core.ExecuteScriptAsync("""
                (() => {
                  const {game,unit,raider,renderer}=window.__raidSmoke;
                  for(let n=0;n<360;n++)game.update(.01);renderer.draw(game,0);
                  return raider.raid.phase==='landed' && Math.abs(raider.raid.remaining-7.4)<.001
                    && raider.x===unit.x && raider.y===unit.y && unit.hp===unit.maxHp;
                })()
                """);
            await using (var output = File.Create(Path.Combine(smokeDirectory!, "pony-landed.png")))
                await core.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, output);
            var raidEscaped = await core.ExecuteScriptAsync("""
                (() => {
                  const {game,unit,renderer}=window.__raidSmoke;
                  for(let n=0;n<765;n++)game.update(.01);renderer.draw(game,0);
                  return game.units.length===0 && game.enemies.length===0 && game.score===0 && game.kills===0
                    && game.departures.some(d=>d.exit==='rope' && d.carried?.id===unit.id);
                })()
                """);
            await using (var output = File.Create(Path.Combine(smokeDirectory!, "pony-escape.png")))
                await core.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, output);
            if (raidWarning != "true" || raidLanded != "true" || raidEscaped != "true")
                throw new IOException($"Pony Ma rope raid failed validation: warning={raidWarning}, landed={raidLanded}, escaped={raidEscaped}");
            var superWarning = await core.ExecuteScriptAsync("""
                (() => {
                  const {GardenGame,GardenRenderer,art}=window.__raidArt;
                  const game=new GardenGame({starter:false,seed:42,eggs:false});game.tokens=99999;
                  for(let row=0;row<5;row++)game.plant('qwen',row,3);
                  game.wave=9;game.start();game.nextWaveTimer=999;
                  const boss=game.spawnEnemy('pony_super',2);boss.x=885;boss.speed=0;
                  boss.superKit={sp:999,monopoly:999,dividend:999};game.castSP(boss);
                  const renderer=new GardenRenderer(document.querySelector('#enemy-smoke-canvas'),art);
                  window.__superSmoke={game,boss,renderer};renderer.draw(game,0);
                  const birds=game.enemies.filter(e=>e.type==='qq_raider');
                  return birds.length===5 && new Set(birds.map(e=>e.raid.targetId)).size===5
                    && birds.every(e=>e.raid.phase==='warning') && art.animations.pony_super && !!art.animations.qq_raider;
                })()
                """);
            await using (var output = File.Create(Path.Combine(smokeDirectory!, "super-warning.png")))
                await core.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, output);
            var superRendering = await core.ExecuteScriptAsync("""
                (() => {
                  const {game,boss,renderer}=window.__superSmoke;
                  for(let n=0;n<360;n++)game.update(.01);
                  game.castDividend(boss);game.damageEnemy(boss,132,{sourceId:game.dividends[0].marks[0].id});
                  game.castMonopoly(boss);renderer.draw(game,0);
                  return game.enemies.filter(e=>e.type==='qq_raider'&&e.raid.phase==='landed').length===5
                    && game.dividends[0].marks.length===3 && game.dividends[0].total===132 && game.monopolyRemaining===20;
                })()
                """);
            await using (var output = File.Create(Path.Combine(smokeDirectory!, "super-boss.png")))
                await core.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, output);
            if (superWarning != "true" || superRendering != "true")
                throw new IOException($"Super boss renderer failed: warning={superWarning}, combat={superRendering}");
            await core.ExecuteScriptAsync("document.querySelector('#enemy-smoke-canvas').remove()");
            // Capture the running production game via one temporary prototype hook;
            // there is no test-only gameplay API in the shipped application.
            var liveLock = await core.ExecuteScriptAsync("""
                (() => {
                  const {GardenGame}=window.__raidArt,original=GardenGame.prototype.resume;
                  GardenGame.prototype.resume=function(options){
                    GardenGame.prototype.resume=original;const resumed=original.call(this,options);
                    window.__liveLockSmoke=this;this.nextWaveTimer=999;this.queue=[];
                    for(const u of this.units)u.attackTimer=u.basicTimer=u.produceTimer=999;
                    const boss=this.spawnEnemy('pony_super',4);boss.speed=0;boss.superKit={sp:999,monopoly:999,dividend:999};
                    this.castMonopoly(boss);this.pause({system:true});return resumed;
                  };
                  document.querySelector('#stage-overlay .overlay-action').click();
                  return !!window.__liveLockSmoke;
                })()
                """);
            await Task.Delay(250);
            var inputBlocked = await core.ExecuteScriptAsync("""
                (() => {
                  const game=window.__liveLockSmoke,before={tokens:game.tokens,units:game.units.length};
                  const key=new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'s'});
                  document.dispatchEvent(key);
                  let clicks=0;const probe=document.createElement('button');probe.onclick=()=>clicks++;
                  document.body.append(probe);probe.click();probe.remove();
                  document.querySelector('.settings-open').click();document.querySelector('#deck-dex').click();
                  document.querySelector('#garden').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,clientX:500,clientY:300}));
                  const blocked=key.defaultPrevented&&clicks===0&&!document.querySelector('#modal').open
                    && document.querySelector('#pause-game').disabled&&!document.querySelector('#monopoly-banner').hidden
                    && document.querySelector('#monopoly-countdown').textContent==='20.0s'
                    && game.tokens===before.tokens&&game.units.length===before.units&&game.phase==='paused';
                  window.dispatchEvent(new Event('desktop:focus'));
                  const resumed=game.phase==='playing'&&!game.systemPaused;game.pause({system:true});
                  return blocked&&resumed;
                })()
                """);
            await using (var output = File.Create(Path.Combine(smokeDirectory!, "monopoly-ui.png")))
                await core.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, output);
            var lockReleased = await core.ExecuteScriptAsync("""
                (() => {
                  const game=window.__liveLockSmoke;game.resume({system:true});
                  for(let n=0;n<2000;n++)game.update(.01);
                  game.pause();return !game.controlsLocked;
                })()
                """);
            await Task.Delay(250);
            var controlsRestored = await core.ExecuteScriptAsync("""
                (() => {
                  document.querySelector('.settings-open').click();
                  const ok=document.querySelector('#monopoly-banner').hidden&&!document.querySelector('.settings-open').disabled
                    &&document.querySelector('#modal').open;
                  document.querySelector('#modal .modal-close')?.click();return ok;
                })()
                """);
            if (liveLock != "true" || inputBlocked != "true" || lockReleased != "true" || controlsRestored != "true")
                throw new IOException($"Monopoly UI failed: live={liveLock}, blocked={inputBlocked}, released={lockReleased}, restored={controlsRestored}");
            await core.ExecuteScriptAsync("""
                (async () => {
                  try {
                    const {GardenGame,GardenRenderer,art}=window.__raidArt;
                    const orders=await import('./trump-boss.js');
                    const canvas=document.createElement('canvas');canvas.id='trump-smoke-canvas';
                    canvas.style.cssText='position:absolute;left:0;top:-7.75862%;width:100%;height:112.06897%;z-index:11';
                    document.querySelector('#canvas-wrap').append(canvas);
                    const game=new GardenGame({starter:false,seed:42,eggs:false});game.tokens=99999;
                    for(let row=0;row<5;row++){const u=game.plant('qwen',row,6).unit;u.attackTimer=u.basicTimer=u.produceTimer=999;}
                    game.wave=12;game.start();game.nextWaveTimer=999;game.airdropTimer=999;
                    const boss=game.spawnEnemy('trump',2);boss.trumpKit={strike:999,deploy:999,shift:999};
                    orders.deployMilitary(game,boss);const guards=game.enemies.filter(e=>e.type==='military_claude');
                    for(const e of guards)e.militaryKit={basic:999,contract:999};
                    const from=boss.row;orders.shiftTrump(game,boss);
                    const swapped=guards.some(e=>e.row===from)&&boss.row!==from;
                    orders.castAirstrike(game,boss);orders.militaryContract(game,guards[0]);
                    const renderer=new GardenRenderer(canvas,art);renderer.draw(game,0);
                    window.__trumpSmoke={game,boss,guards,renderer};
                    window.__trumpSmokeState={ok:true,swapped,guards:guards.length,lanes:new Set(game.enemies.map(e=>e.row)).size,
                      strikes:game.airstrikes.length,fixed:game.enemies.every(e=>e.x===1055&&e.speed===0),
                      art:!!art.animations.trump&&!!art.animations.military_claude};
                  }catch(error){window.__trumpSmokeState={ok:false,error:String(error)};}
                })()
                """);
            string trumpRendering = "null";
            for (var i = 0; i < 100; i++)
            {
                trumpRendering = await core.ExecuteScriptAsync("window.__trumpSmokeState || null");
                if (trumpRendering != "null") break;
                await Task.Delay(100);
            }
            using var trumpJson = JsonDocument.Parse(trumpRendering);
            var trumpState = trumpJson.RootElement;
            if (trumpRendering == "null" || !trumpState.GetProperty("ok").GetBoolean()
                || !trumpState.GetProperty("swapped").GetBoolean() || !trumpState.GetProperty("fixed").GetBoolean()
                || !trumpState.GetProperty("art").GetBoolean() || trumpState.GetProperty("guards").GetInt32() != 4
                || trumpState.GetProperty("strikes").GetInt32() != 5 || trumpState.GetProperty("lanes").GetInt32() != 5)
                throw new IOException($"Trump deployment and art failed: {trumpRendering}");
            await using (var output = File.Create(Path.Combine(smokeDirectory!, "trump-orders.png")))
                await core.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, output);
            var bombing = await core.ExecuteScriptAsync("""
                (() => {
                  const {game,boss,renderer}=window.__trumpSmoke;
                  const before=game.units.reduce((total,u)=>total+u.hp,0);
                  for(let n=0;n<150;n++)game.update(.01);renderer.draw(game,0);
                  const hit=game.units.reduce((total,u)=>total+u.hp,0)<before&&game.airstrikes.length===0;
                  game.airstrikes=[];game.militaryWrits=[];game.effects=[];
                  game.damageEnemy(boss,1e9,{direct:true});const welfare=boss.welfareUsed&&Math.abs(boss.hp-boss.maxHp*.3)<.001;
                  game.damageEnemy(boss,1e9,{direct:true});renderer.draw(game,0);
                  return hit&&welfare&&boss.retreat?.remaining===15&&Math.abs(boss.hp-boss.maxHp*.01)<.001&&game.kills===0;
                })()
                """);
            await using (var output = File.Create(Path.Combine(smokeDirectory!, "trump-retreat.png")))
                await core.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, output);
            var withdrawal = await core.ExecuteScriptAsync("""
                (() => {
                  const {game,boss,renderer}=window.__trumpSmoke;
                  for(let n=0;n<1500;n++)game.update(.01);renderer.draw(game,0);
                  return !game.enemies.includes(boss)&&boss.withdrawn&&game.enemies.length===4
                    &&game.kills===0&&game.score===0&&game.defeated.trump===undefined&&game.phase==='playing';
                })()
                """);
            await using (var output = File.Create(Path.Combine(smokeDirectory!, "trump-withdrawn.png")))
                await core.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, output);
            if (bombing != "true" || withdrawal != "true")
                throw new IOException($"Trump bombing and retreat failed: bombing={bombing}, withdrawal={withdrawal}");
            await core.ExecuteScriptAsync("document.querySelector('#trump-smoke-canvas').remove()");
            await core.ExecuteScriptAsync("""
                (async () => {
                  try {
                    const {GardenGame,GardenRenderer,art}=window.__raidArt;
                    const orders=await import('./elon-boss.js');
                    const canvas=document.createElement('canvas');canvas.id='elon-smoke-canvas';
                    canvas.style.cssText='position:absolute;left:0;top:-7.75862%;width:100%;height:112.06897%;z-index:11';
                    document.querySelector('#canvas-wrap').append(canvas);
                    const renderer=new GardenRenderer(canvas,art);
                    window.__elonReset=()=>{
                      const game=new GardenGame({starter:false,lang:'zh',seed:42,eggs:false});game.tokens=99999;
                      const back=['deepseek','kimi','grok','glm','doubao'],mid=['gemini','minimax','chatgpt','claude','mimo'];
                      for(let row=0;row<5;row++)for(const [model,col] of [[back[row],1],[mid[row],3],['qwen',6]]){
                        let u;for(let n=0;n<7;n++)u=game.plant(model,row,col).unit;
                        u.attackTimer=u.basicTimer=u.produceTimer=999;
                      }
                      game.wave=15;game.start();game.nextWaveTimer=game.airdropTimer=999;
                      const boss=game.spawnEnemy('elon_super',2);boss.x=880;boss.speed=0;boss.attackTimer=999;
                      for(const key of Object.keys(boss.elonKit.timers))boss.elonKit.timers[key]=999;
                      window.__elonSmoke={game,boss,orders,renderer};return window.__elonSmoke;
                    };
                    const {game,boss}=window.__elonReset();
                    orders.castStarlink(game,boss);orders.castProjections(game,boss);orders.castSearch(game,boss);orders.castNotes(game,boss);
                    renderer.draw(game,0);
                    window.__elonSmokeState={ok:true,art:['elon_super','starlink_drone','grok_projection'].every(id=>!!art.animations[id]),
                      satellites:game.enemies.filter(e=>e.type==='starlink_drone').length,
                      projections:game.enemies.filter(e=>e.type==='grok_projection').length,
                      skills:(await import('./elon-data.js')).ELON_SKILLS.length,missing:art.missingAnimations};
                  }catch(error){window.__elonSmokeState={ok:false,error:String(error)};}
                })()
                """);
            string elonRendering = "null";
            for (var i = 0; i < 100; i++)
            {
                elonRendering = await core.ExecuteScriptAsync("window.__elonSmokeState || null");
                if (elonRendering != "null") break;
                await Task.Delay(100);
            }
            using var elonJson = JsonDocument.Parse(elonRendering);
            var elonState = elonJson.RootElement;
            if (elonRendering == "null" || !elonState.GetProperty("ok").GetBoolean()
                || !elonState.GetProperty("art").GetBoolean() || elonState.GetProperty("skills").GetInt32() != 11
                || elonState.GetProperty("satellites").GetInt32() != 3 || elonState.GetProperty("projections").GetInt32() != 2
                || elonState.GetProperty("missing").GetArrayLength() != 0)
                throw new IOException($"Elon Super artwork or encounter failed: {elonRendering}");
            await using (var output = File.Create(Path.Combine(smokeDirectory!, "elon-super-starlink.png")))
                await core.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, output);
            var elonFlight = await core.ExecuteScriptAsync("""
                (()=>{
                  const {game,boss,orders,renderer}=window.__elonReset();
                  orders.castStarlink(game,boss);orders.castLaunch(game,boss);
                  for(let n=0;n<75;n++)game.update(.01);renderer.draw(game,0);
                  return boss.elonKit.action.kind==='charge'&&boss.x===880;
                })()
                """);
            await using (var output = File.Create(Path.Combine(smokeDirectory!, "elon-super-launch.png")))
                await core.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, output);
            var elonSocial = await core.ExecuteScriptAsync("""
                (()=>{
                  const {game,boss,orders,renderer}=window.__elonReset();
                  orders.castTrend(game,boss);orders.castRepost(game,boss);
                  for(const u of game.units.slice(0,2)){orders.recordElonAttack(game,u);orders.recordElonAttack(game,u);}
                  orders.castLimit(game,boss);renderer.draw(game,0);
                  return game.elonOrders.some(o=>o.kind==='repost')&&game.elonLimits.length===2&&!!boss.elonKit.trend;
                })()
                """);
            await using (var output = File.Create(Path.Combine(smokeDirectory!, "elon-super-x.png")))
                await core.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, output);
            var elonViral = await core.ExecuteScriptAsync("""
                (()=>{
                  const {game,boss,orders,renderer}=window.__elonReset();
                  boss.hp=boss.maxHp*.5;game.update(.01);orders.castLaunch(game,boss);renderer.draw(game,0);
                  return boss.enraged&&boss.elonKit.action.kind==='shift'&&boss.elonKit.action.after==='launch';
                })()
                """);
            await using (var output = File.Create(Path.Combine(smokeDirectory!, "elon-super-viral.png")))
                await core.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, output);
            var elonCorrection = await core.ExecuteScriptAsync("""
                (()=>{
                  const {game,boss,orders,renderer}=window.__elonReset();orders.castNotes(game,boss);
                  for(const u of game.units.slice(0,3))game.damageEnemy(boss,1,{sourceId:u.id});
                  renderer.draw(game,0);return !boss.elonKit.note&&boss.elonKit.vulnerableUntil===4;
                })()
                """);
            await using (var output = File.Create(Path.Combine(smokeDirectory!, "elon-super-notes.png")))
                await core.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, output);
            var elonDefeat = await core.ExecuteScriptAsync("""
                (()=>{
                  const {game,boss,orders,renderer}=window.__elonSmoke;
                  orders.castStarlink(game,boss);orders.castProjections(game,boss);orders.castSearch(game,boss);
                  game.damageEnemy(boss,1e9,{direct:true});game.update(.01);renderer.draw(game,0);
                  return game.score===6000&&game.kills===1&&game.enemies.length===0&&game.elonOrders.length===0;
                })()
                """);
            if (new[] { elonFlight, elonSocial, elonViral, elonCorrection, elonDefeat }.Any(value => value != "true"))
                throw new IOException($"Elon Super combat failed: flight={elonFlight}, social={elonSocial}, viral={elonViral}, notes={elonCorrection}, defeat={elonDefeat}");
            await core.ExecuteScriptAsync("document.querySelector('#elon-smoke-canvas').remove()");
            var report = new
            {
                success = scriptErrors.Count == 0, startup = JsonSerializer.Deserialize<JsonElement>(startup),
                browserVersion = core.Environment.BrowserVersionString, zoom = browser.ZoomFactor,
                zoomLocked = !core.Settings.IsZoomControlEnabled && !core.Settings.IsPinchZoomEnabled,
                nativeWindow = new { Text, ClientSize.Width, ClientSize.Height, Dpi = DeviceDpi, MinimumSize },
                guideModal = dex == "true", settingsModal = settings == "true", fullscreen = fullscreenWorked,
                resize = resizeFits == "true", placementRestored, deployment = deployment == "true", focusPause = focusPause == "true",
                enemyRendering = JsonSerializer.Deserialize<JsonElement>(enemyRendering),
                enemyPortraits = portraitsReady,
                scorePanel = scorePanel == "true",
                ropeRaid = new { warning = raidWarning == "true", landed = raidLanded == "true", escaped = raidEscaped == "true" },
                superBoss = new { warning = superWarning == "true", combat = superRendering == "true", inputBlocked = inputBlocked == "true", controlsRestored = controlsRestored == "true" },
                trumpBoss = new { rendering = JsonSerializer.Deserialize<JsonElement>(trumpRendering), bombing = bombing == "true", withdrawal = withdrawal == "true" },
                elonBoss = new { rendering = JsonSerializer.Deserialize<JsonElement>(elonRendering), flight = elonFlight == "true", social = elonSocial == "true", viral = elonViral == "true", correction = elonCorrection == "true", defeat = elonDefeat == "true" },
                scriptErrors
            };
            await File.WriteAllTextAsync(Path.Combine(smokeDirectory!, "report.json"), JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true }));
            ExitCode = scriptErrors.Count == 0 ? 0 : 1;
            Close();
        }
        catch (Exception error) { await ReportFailure(error); }
    }
}
