import axios from 'axios';
import readlineSync from 'readline-sync';

const OXY_CONFIG = {
    API_BASE: 'https://discord.com/api/v9',
    USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    DELAYS: {
        MESSAGE_DELETE: 1200,
        RATE_LIMIT_BASE: 3000,
        RETRY_INCREMENT: 1500,
        ERROR_RECOVERY: 5000
    },
    LIMITS: {
        MESSAGES_PER_BATCH: 50,
        MAX_RETRIES: 5,
        BATCH_SIZE: 100
    }
};

const OXY_COLORS = {
    RED: '\x1b[91m',
    GREEN: '\x1b[92m',
    YELLOW: '\x1b[93m',
    BLUE: '\x1b[94m',
    MAGENTA: '\x1b[95m',
    CYAN: '\x1b[96m',
    WHITE: '\x1b[97m',
    BOLD: '\x1b[1m',
    UNDERLINE: '\x1b[4m',
    RESET: '\x1b[0m'
};

const createOxyLogger = () => {
    const log = (message, color = OXY_COLORS.WHITE) => console.log(`${color}${message}${OXY_COLORS.RESET}`);
    const logError = (message) => log(`❌ ${message}`, OXY_COLORS.RED + OXY_COLORS.BOLD);
    const logSuccess = (message) => log(`✅ ${message}`, OXY_COLORS.GREEN);
    const logWarning = (message) => log(`⚠️ ${message}`, OXY_COLORS.YELLOW);
    const logInfo = (message) => log(`ℹ️ ${message}`, OXY_COLORS.CYAN);
    const logProgress = (message) => process.stdout.write(`\r${OXY_COLORS.GREEN}${message}${OXY_COLORS.RESET}`);
    
    return { log, logError, logSuccess, logWarning, logInfo, logProgress };
};

const createOxyApiClient = (token) => {
    const headers = {
        'Authorization': token,
        'User-Agent': OXY_CONFIG.USER_AGENT,
        'Content-Type': 'application/json'
    };
    
    const client = axios.create({
        baseURL: OXY_CONFIG.API_BASE,
        headers,
        timeout: 30000
    });
    
    client.interceptors.response.use(
        response => response,
        async error => {
            if (error.response?.status === 429) {
                const retryAfter = error.response.data?.retry_after || 5;
                throw new Error(`RATE_LIMIT:${retryAfter}`);
            }
            throw error;
        }
    );
    
    return client;
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const validateOxyToken = async (apiClient, logger) => {
    try {
        logger.logInfo('Token doğrulanıyor...');
        const response = await apiClient.get('/users/@me');
        return response.data;
    } catch (error) {
        logger.logError('Geçersiz token! Lütfen geçerli bir token girin.');
        throw error;
    }
};

const createOxyDMChannel = async (apiClient, targetUserId, logger) => {
    try {
        logger.logInfo('DM kanalı oluşturuluyor...');
        const response = await apiClient.post('/users/@me/channels', {
            recipient_id: targetUserId
        });
        return response.data;
    } catch (error) {
        logger.logError(`Kullanıcı ID'si bulunamadı veya DM kanalı oluşturulamadı: ${error.message}`);
        throw error;
    }
};

const fetchOxyMessages = async (apiClient, channelId, beforeId = null, logger) => {
    const url = `/channels/${channelId}/messages?limit=${OXY_CONFIG.LIMITS.BATCH_SIZE}`;
    const fullUrl = beforeId ? `${url}&before=${beforeId}` : url;
    
    try {
        const response = await apiClient.get(fullUrl);
        return response.data;
    } catch (error) {
        if (error.message.startsWith('RATE_LIMIT:')) {
            const retryAfter = parseFloat(error.message.split(':')[1]);
            logger.logWarning(`Mesaj listesi alınırken hız sınırı aşıldı. ${retryAfter} saniye bekleniyor...`);
            await sleep(retryAfter * 1000);
            return await fetchOxyMessages(apiClient, channelId, beforeId, logger);
        }
        logger.logWarning(`Mesajlar alınamadı: ${error.message}`);
        throw error;
    }
};

const deleteOxyMessage = async (apiClient, channelId, messageId, logger, retryCount = 0) => {
    try {
        await apiClient.delete(`/channels/${channelId}/messages/${messageId}`);
        return true;
    } catch (error) {
        if (error.message.startsWith('RATE_LIMIT:')) {
            if (retryCount >= OXY_CONFIG.LIMITS.MAX_RETRIES) {
                logger.logError(`Mesaj silinemedi (${OXY_CONFIG.LIMITS.MAX_RETRIES} deneme sonrası): ${messageId}`);
                return false;
            }
            
            const retryAfter = parseFloat(error.message.split(':')[1]);
            const delay = retryAfter + (retryCount * OXY_CONFIG.DELAYS.RETRY_INCREMENT);
            logger.logWarning(`Hız sınırı aşıldı. ${delay} saniye bekleniyor... (Deneme: ${retryCount + 1}/${OXY_CONFIG.LIMITS.MAX_RETRIES})`);
            await sleep(delay * 1000);
            return await deleteOxyMessage(apiClient, channelId, messageId, logger, retryCount + 1);
        }
        
        logger.logWarning(`Mesaj silinemedi: ${error.message}`);
        return false;
    }
};

const processOxyMessageBatch = async (apiClient, channelId, messages, currentUserId, logger) => {
    const myMessages = messages.filter(msg => msg.author.id === currentUserId);
    
    if (myMessages.length === 0) {
        return 0;
    }
    
    logger.logInfo(`${myMessages.length} mesaj işleniyor...`);
    
    let deletedCount = 0;
    for (const message of myMessages) {
        const success = await deleteOxyMessage(apiClient, channelId, message.id, logger);
        if (success) {
            deletedCount++;
            logger.logProgress(`Silinen mesaj: ${deletedCount}`);
        }
        await sleep(OXY_CONFIG.DELAYS.MESSAGE_DELETE);
    }
    
    return deletedCount;
};

const oxyCleanupDMMessages = async (token, targetUserId) => {
    const logger = createOxyLogger();
    const apiClient = createOxyApiClient(token);
    const startTime = Date.now();
    let totalDeleted = 0;
    
    try {
        const userInfo = await validateOxyToken(apiClient, logger);
        logger.logSuccess(`${userInfo.username} ile giriş yapıldı`);
        
        const channelInfo = await createOxyDMChannel(apiClient, targetUserId, logger);
        const channelId = channelInfo.id;
        
        logger.logInfo(`${targetUserId} ID'li kullanıcı ile DM'ler taranıyor...`);
        
        let hasMoreMessages = true;
        let lastMessageId = null;
        
        while (hasMoreMessages) {
            try {
                const messages = await fetchOxyMessages(apiClient, channelId, lastMessageId, logger);
                
                if (!messages || messages.length === 0) {
                    hasMoreMessages = false;
                    break;
                }
                
                lastMessageId = messages[messages.length - 1].id;
                const deletedInBatch = await processOxyMessageBatch(apiClient, channelId, messages, userInfo.id, logger);
                totalDeleted += deletedInBatch;
                
                if (messages.length < OXY_CONFIG.LIMITS.BATCH_SIZE) {
                    hasMoreMessages = false;
                }
                
            } catch (error) {
                logger.logWarning(`Mesaj işleme hatası: ${error.message}`);
                await sleep(OXY_CONFIG.DELAYS.ERROR_RECOVERY);
                continue;
            }
        }
        
        const totalTime = (Date.now() - startTime) / 1000;
        logger.logSuccess('İşlem tamamlandı!');
        logger.log(`• Toplam silinen mesaj: ${totalDeleted}`, OXY_COLORS.CYAN);
        logger.log(`• Toplam süre: ${totalTime.toFixed(1)} saniye`, OXY_COLORS.CYAN);
        
        if (totalDeleted > 0) {
            const avgSpeed = totalTime / totalDeleted;
            logger.log(`• Ortalama hız: ${avgSpeed.toFixed(1)} saniye/mesaj`, OXY_COLORS.CYAN);
        }
        
    } catch (error) {
        logger.logError(`Kritik hata: ${error.message}`);
        throw error;
    }
};

const displayOxyBanner = () => {
    const banner = `
${OXY_COLORS.CYAN}
██╗   ██╗███████╗ ██████╗    ██████╗ ███╗   ███╗     ██████╗██╗     ███████╗ █████╗ ███╗   ██╗███████╗██████╗ 
██║   ██║██╔════╝██╔════╝    ██╔══██╗████╗ ████║    ██╔════╝██║     ██╔════╝██╔══██╗████╗  ██║██╔════╝██╔══██╗
██║   ██║███████╗██║         ██║  ██║██╔████╔██║    ██║     ██║     █████╗  ███████║██╔██╗ ██║█████╗  ██████╔╝
╚██╗ ██╔╝╚════██║██║         ██║  ██║██║╚██╔╝██║    ██║     ██║     ██╔══╝  ██╔══██║██║╚██╗██║██╔══╝  ██╔══██╗
 ╚████╔╝ ███████║╚██████╗    ██████╔╝██║ ╚═╝ ██║    ╚██████╗███████╗███████╗██║  ██║██║ ╚████║███████╗██║  ██║
  ╚═══╝  ╚══════╝ ╚═════╝    ╚═════╝ ╚═╝     ╚═╝     ╚═════╝╚══════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝
${OXY_COLORS.MAGENTA}                                            by oxy${OXY_COLORS.RESET}
`;
    console.log(banner);
};

const getOxyUserInput = () => {
    const token = readlineSync.question(`${OXY_COLORS.BLUE}Discord tokeninizi girin: ${OXY_COLORS.RESET}`).trim();
    const targetId = readlineSync.question(`${OXY_COLORS.BLUE}Hedef kullanıcı ID'sini girin: ${OXY_COLORS.RESET}`).trim();
    
    if (!token || !targetId) {
        throw new Error('Token ve kullanıcı ID\'si gereklidir!');
    }
    
    return { token, targetId };
};

const oxyMain = async () => {
    try {
        displayOxyBanner();
        const { token, targetId } = getOxyUserInput();
        
        console.log(`\n${OXY_COLORS.GREEN}🔑 Token alındı. İşlem başlıyor...${OXY_COLORS.RESET}\n`);
        
        await oxyCleanupDMMessages(token, targetId);
        
        console.log(`\n${OXY_COLORS.GREEN}${OXY_COLORS.BOLD}🏁 İşlem tamamlandı!${OXY_COLORS.RESET}`);
        
    } catch (error) {
        console.log(`\n${OXY_COLORS.RED}❌ Hata: ${error.message}${OXY_COLORS.RESET}`);
        process.exit(1);
    }
};

process.on('SIGINT', () => {
    console.log(`\n\n${OXY_COLORS.YELLOW}⚠️ İşlem kullanıcı tarafından durduruldu.${OXY_COLORS.RESET}`);
    process.exit(0);
});

oxyMain();