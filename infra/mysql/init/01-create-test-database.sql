-- Executado apenas na primeira inicialização do container.
-- Banco separado para os testes automatizados, para não apagar os dados de desenvolvimento.
CREATE DATABASE IF NOT EXISTS logos_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON logos_test.* TO 'logos'@'%';
FLUSH PRIVILEGES;
