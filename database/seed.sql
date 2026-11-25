-- Execute após o schema, selecionando um banco de demonstração vazio.
-- Contas fictícias em example.test. Senha de ambas: DemoFinancas123.
SET NAMES utf8mb4;
START TRANSACTION;

SET @hoje = UTC_DATE();
SET @mes = DATE_SUB(@hoje, INTERVAL (DAYOFMONTH(@hoje) - 1) DAY);
SET @anterior = DATE_SUB(@mes, INTERVAL 1 MONTH);
SET @retrasado = DATE_SUB(@mes, INTERVAL 2 MONTH);
SET @a = NULL, @b = NULL;
INSERT INTO usuarios (nome, email, cpf, senha_hash) VALUES
  ('Pessoa Demo A', 'demo.a@example.test', '90000000094', '$2b$10$tSAcjZx32QkGVN/z3PpdXOx/OLp8GtpoMNTF6vQu0OPxXo/4IbqQq'),
  ('Pessoa Demo B', 'demo.b@example.test', '90000000175', '$2b$10$C/uoXLnuRy7vUEAO1X3PDOn6.IZFQlvo7dfru2GrKep0hipiIcfYe');
SET @inseridos = ROW_COUNT();
SELECT id INTO @a FROM usuarios WHERE @inseridos = 2 AND email = 'demo.a@example.test';
SELECT id INTO @b FROM usuarios WHERE @inseridos = 2 AND email = 'demo.b@example.test';

INSERT INTO categorias (usuario_id, nome, tipo) VALUES
  (@a, 'Receita Demo A', 'entrada'), (@a, 'Compras Demo A', 'saida'),
  (@b, 'Receita Demo B', 'entrada'), (@b, 'Compras Demo B', 'saida');
SELECT id INTO @receita_a FROM categorias WHERE usuario_id = @a AND tipo = 'entrada';
SELECT id INTO @compras_a FROM categorias WHERE usuario_id = @a AND tipo = 'saida';
SELECT id INTO @receita_b FROM categorias WHERE usuario_id = @b AND tipo = 'entrada';
SELECT id INTO @compras_b FROM categorias WHERE usuario_id = @b AND tipo = 'saida';

INSERT INTO fontes_destinos (usuario_id, nome, tipo, dia_fechamento, dia_vencimento, limite) VALUES
  (@a, 'Conta Demo A', 'conta', NULL, NULL, NULL),
  (@a, 'Cartão Demo A', 'cartao_credito', 15, 22, 2000.00),
  (@b, 'Conta Demo B', 'conta', NULL, NULL, NULL),
  (@b, 'Cartão Demo B', 'cartao_credito', 25, 5, 1000.00);
SELECT id INTO @conta_a FROM fontes_destinos WHERE usuario_id = @a AND tipo = 'conta';
SELECT id INTO @cartao_a FROM fontes_destinos WHERE usuario_id = @a AND tipo = 'cartao_credito';
SELECT id INTO @conta_b FROM fontes_destinos WHERE usuario_id = @b AND tipo = 'conta';
SELECT id INTO @cartao_b FROM fontes_destinos WHERE usuario_id = @b AND tipo = 'cartao_credito';

INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id) VALUES
  (@a, 'entrada', 'Receita A há dois meses', 3000.00, @retrasado, @receita_a, @conta_a),
  (@a, 'saida', 'Compra A há dois meses', 180.00, @retrasado, @compras_a, @conta_a),
  (@a, 'entrada', 'Receita A do mês anterior', 3100.00, @anterior, @receita_a, @conta_a),
  (@a, 'saida', 'Compra A do mês anterior', 200.00, @anterior, @compras_a, @conta_a),
  (@a, 'entrada', 'Receita A deste mês', 3200.00, @mes, @receita_a, @conta_a),
  (@a, 'saida', 'Compra A na conta', 250.00, @mes, @compras_a, @conta_a),
  (@b, 'entrada', 'Receita B há dois meses', 1400.00, @retrasado, @receita_b, @conta_b),
  (@b, 'entrada', 'Receita B do mês anterior', 1500.00, @anterior, @receita_b, @conta_b),
  (@b, 'entrada', 'Receita B deste mês', 1600.00, @mes, @receita_b, @conta_b),
  (@b, 'saida', 'Compra B no cartão', 45.00, @hoje, @compras_b, @cartao_b);

SET @grupo = UUID();
INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id,
                         parcela_atual, total_parcelas, grupo_parcelamento) VALUES
  (@a, 'saida', 'Compra parcelada Demo A', 33.34, @hoje, @compras_a, @cartao_a, 1, 3, @grupo),
  (@a, 'saida', 'Compra parcelada Demo A', 33.33, @hoje, @compras_a, @cartao_a, 2, 3, @grupo),
  (@a, 'saida', 'Compra parcelada Demo A', 33.33, @hoje, @compras_a, @cartao_a, 3, 3, @grupo);

COMMIT;
