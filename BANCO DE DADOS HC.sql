SELECT 
    p.idPedido,
    p.dataHora,
    c.nome AS cliente,
    p.status,
    pr.nome AS cupcake,
    ip.quantidade,
    ip.precoUnitario,
    (ip.quantidade * ip.precoUnitario) AS totalItem
FROM Pedido p
JOIN Cliente c ON p.idCliente = c.idCliente
JOIN ItemPedido ip ON p.idPedido = ip.idPedido
JOIN Produto pr ON ip.idProduto = pr.idProduto
WHERE p.idPedido = 4; -- Substitua pelo número do pedido que quer ver