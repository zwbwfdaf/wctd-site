// Service Worker for 文创邦 - 网络优先稳健版
// 版本号（修改即触发更新）
const CACHE_NAME = 'wenchuang-platform-v1.1';

// 预缓存的静态资源（尽量少放易变文件）
const PRECACHE_URLS = [
	'./',
	'./index.html',
	'./mobile-login.html',
	'./styles.css',
	'./app-launcher.js',
	'./realtime.js',
	'./mobile-manifest.json'
];

// 安装：预缓存核心资源并立即激活新的 SW
self.addEventListener('install', (event) => {
	console.log('📦 Service Worker 安装中...');
	event.waitUntil(
		caches.open(CACHE_NAME)
			.then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
			.finally(() => self.skipWaiting())
	);
});

// 激活：清理旧缓存并接管页面
self.addEventListener('activate', (event) => {
	console.log('🚀 Service Worker 激活中...');
	event.waitUntil(
		caches.keys().then((names) =>
			Promise.all(
				names.map((name) => (name !== CACHE_NAME ? caches.delete(name) : Promise.resolve()))
			)
		).then(() => clients.claim())
	);
});

// 工具：将响应写入缓存（仅 GET 且 200 的 basic/opaque）
async function putInCache(request, response) {
	try {
		if (
			request.method === 'GET' &&
			response &&
			(response.status === 200 || response.type === 'opaque')
		) {
			const cache = await caches.open(CACHE_NAME);
			await cache.put(request, response.clone());
		}
	} catch (e) {
		// 忽略缓存失败
	}
}

// 获取缓存命中
async function getFromCache(request) {
	const cache = await caches.open(CACHE_NAME);
	const cached = await cache.match(request);
	return (
		cached ||
		(request.destination === 'document' ? await cache.match('./index.html') : undefined)
	);
}

// fetch 事件：
// 1) 导航请求：网络优先，失败回退缓存/主页
// 2) 其他 GET：网络优先，失败回退缓存
// 3) 非 GET：直接走网络
self.addEventListener('fetch', (event) => {
	const { request } = event;

	// 仅处理同源请求，第三方直接放过
	const url = new URL(request.url);
	if (self.location.origin !== url.origin) {
		return; // 让浏览器自己处理
	}

	// 非 GET 直接网络
	if (request.method !== 'GET') {
		return;
	}

	event.respondWith(
		(async () => {
			try {
				// 导航/HTML：网络优先
				if (request.mode === 'navigate' || request.destination === 'document') {
					const netRes = await fetch(request, { cache: 'no-store' });
					putInCache(request, netRes.clone());
					return netRes;
				}

				// 其他静态资源：网络优先
				const netRes = await fetch(request);
					putInCache(request, netRes.clone());
				return netRes;
			} catch (err) {
				// 网络失败 → 回退缓存
				const fallback = await getFromCache(request);
				if (fallback) return fallback;
				// 最后兜底返回简易 503 响应，避免 ERR_FAILED
				return new Response('网络不可用，请稍后重试。', { status: 503, statusText: 'Service Unavailable' });
			}
		})()
	);
});

// 推送通知（保留原逻辑）
self.addEventListener('push', (event) => {
	console.log('📢 收到推送消息');
	const options = {
		body: event.data ? event.data.text() : '您有新的任务更新',
		icon: './mobile-assets/icon-192x192.png',
		badge: './mobile-assets/badge-72x72.png',
		tag: 'wenchuang-notification',
		requireInteraction: true,
		actions: [
			{ action: 'view', title: '查看', icon: './mobile-assets/view-icon.png' },
			{ action: 'close', title: '关闭', icon: './mobile-assets/close-icon.png' }
		]
	};
    event.waitUntil(self.registration.showNotification('文创邦', options));
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	if (event.action === 'view') {
		event.waitUntil(clients.openWindow('./index.html'));
	}
});

// 后台同步（保留占位）
self.addEventListener('sync', (event) => {
	if (event.tag === 'background-sync') {
		event.waitUntil(Promise.resolve());
	}
});

// 支持页面触发立即启用新 SW
self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}
});








