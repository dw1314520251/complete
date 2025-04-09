const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const cors = require('cors');
const sharp = require('sharp');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const RECRAFT_API_KEY = process.env.RECRAFT_API_KEY;
const RECRAFT_API_URL = 'https://external.api.recraft.ai/v1/images/imageToImage';

app.post('/generate-image', upload.single('image'), async (req, res) => {console.log('req.file:', req.file); 
    try {
        if (!req.file) {
            return res.status(400).json({ error: '请上传图片文件' });
        }

        const stylePrompt = req.body.prompt || '';
        if (!stylePrompt) {
            return res.status(400).json({ error: '请提供风格提示' });
        }

        const strength = parseFloat(req.body.strength);
        if (isNaN(strength) || strength < 0 || strength > 1) {
            return res.status(400).json({ error: '强度值必须在 0 到 1 之间' });
        }

        // 验证图片分辨率
        const image = sharp(req.file.buffer);
        const metadata = await image.metadata();
        const resolution = metadata.width * metadata.height;
        if (resolution > 16777216) {
            return res.status(400).json({ error: '图片分辨率不能超过 16 MP，请重新上传。' });
        }

        // 解构获取文件名和 MIME 类型
        const { originalname, mimetype } = req.file;
        
        const formData = new FormData();
        // 附加文件时包含文件名和 MIME 类型（关键修改点）
        formData.append('image', req.file.buffer, { 
            filename: originalname, 
            contentType: mimetype 
        });
        formData.append('prompt', stylePrompt);
        formData.append('strength', strength);

        const response = await axios.post(
            RECRAFT_API_URL,
            formData,
            {
                headers: {
                    'Authorization': `Bearer ${RECRAFT_API_KEY}`,
                    // 保持自动生成的 multipart/form-data 头部，不手动设置 Content-Type
                }
            }
        );

        if (response.status !== 200) {
            throw new Error(`Recraft API 返回非成功状态码: ${response.status}`);
        }

        const result = response.data;
        const generatedImageUrl = result.data[0].url;
        res.status(200).json({ output: generatedImageUrl });

    } catch (error) {
        console.error('生成图片失败:', error);
        res.status(500).json({ error: `图片生成失败，请稍后重试。错误详情: ${error.message}` });
    }
});

app.listen(port, () => {
    console.log(`服务器运行在端口 ${port}`);
});