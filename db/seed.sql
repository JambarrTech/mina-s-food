-- ============================================================================
-- Mina's Food - Pâtisserie Artisanale (Mbour, Sénégal)
-- Seed des données initiales pour Neon
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Produits du catalogue
-- ----------------------------------------------------------------------------
INSERT INTO products (id, name, category, description, price, image, is_available, is_customizable, preparation_time, highlight_badge, allergens) VALUES
  ('prod-gateau-royal-chocolat', 'Gâteau Royal Chocolat & Praliné Croustillant', 'gateaux',
   'Notre signature incontournable : biscuit succès noisette, croustillant praliné feuillantine et mousse au chocolat noir grand cru 70%. Personnalisable avec message au chocolat offert.',
   12000, 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80', true, true,
   'Sur commande (24h) ou dispo selon stock', '⭐ Bestseller Mbour',
   '["Gluten", "Lait", "Fruits à coque", "Œufs"]'::jsonb),

  ('prod-red-velvet-mina', 'Layer Cake Red Velvet Suprême', 'gateaux',
   'La douceur incarnée : génoise veloutée écarlate au cacao fin et cream cheese onctueux vanillé. Parfait pour les anniversaires et déclarations d''amour.',
   14000, 'https://images.unsplash.com/photo-1586788680434-30d324b2d46f?auto=format&fit=crop&w=900&q=80', true, true,
   'Sur commande (24h)', '❤️ Coup de cœur',
   '["Gluten", "Lait", "Œufs"]'::jsonb),

  ('prod-entremets-mangue-passion', 'Entremets Douceur Mangue de Casamance & Passion', 'gateaux',
   'Une explosion tropicale fraîche : biscuit dacquoise coco, compotée de mangues fraîches de Casamance et bavaroise acidulée fruit de la passion.',
   13500, 'https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&w=900&q=80', true, true,
   'Sur commande (24h)', '🥭 Saveur Tropicale',
   '["Lait", "Œufs", "Fruits à coque"]'::jsonb),

  ('prod-foret-noire-tradition', 'Forêt-Noire Traditionnelle Mina', 'gateaux',
   'Génoise cacao moelleuse imbibée de sirop kirsch doux sans alcool, chantilly fraîche montée au mascarpone et cerises amarena gourmandes.',
   11000, 'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?auto=format&fit=crop&w=900&q=80', true, true,
   'Prêt en 2h ou sur commande', NULL,
   '["Gluten", "Lait", "Œufs"]'::jsonb),

  ('prod-croissant-pur-beurre', 'Croissant Feuilleté Pur Beurre', 'viennoiseries',
   'Croustillant dehors, alvéolé et fondant dedans, façonné avec du vrai beurre chaque matin dans notre fournil à Mbour.',
   600, 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=900&q=80', true, false,
   'Disponible en boutique dès 07h30', '🥖 Du jour',
   '["Gluten", "Lait"]'::jsonb),

  ('prod-pain-au-chocolat', 'Pain au Chocolat Bâtonnets Purs', 'viennoiseries',
   'Double barre de chocolat noir riche dans un feuilletage pur beurre doré au jaune d''œuf.',
   700, 'https://images.unsplash.com/photo-1530610476181-d83430b64dcd?auto=format&fit=crop&w=900&q=80', true, false,
   'Disponible en vitrine', '🍫 Gourmand',
   '["Gluten", "Lait", "Soja"]'::jsonb),

  ('prod-pain-aux-raisins', 'Pain aux Raisins & Crème Pâtissière Vanille', 'viennoiseries',
   'Spirale feuilletée généreuse garnie de crème pâtissière parfumée à la vanille et raisins blonds macérés.',
   750, 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80', true, false,
   'Disponible en vitrine', NULL,
   '["Gluten", "Lait", "Œufs"]'::jsonb),

  ('prod-brioche-tressee-sucre', 'Brioche Moelleuse Tressée au Sucre Perlé', 'viennoiseries',
   'Brioche familiale au beurre frais, mie filante et grains de sucre croustillants. Idéale pour le petit déjeuner à Mbour.',
   2500, 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?auto=format&fit=crop&w=900&q=80', true, false,
   'Disponible en boutique', NULL,
   '["Gluten", "Lait", "Œufs"]'::jsonb),

  ('prod-millefeuille-vanille', 'Mille-feuille Caramélisé Vanille Bourbon', 'patisseries_individuelles',
   'Trois couches de pâte feuilletée caramélisée croustillante et crème diplomate légère à la vanille bourbon naturelle.',
   1800, 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80', true, false,
   'Disponible en vitrine', '✨ Incontournable',
   '["Gluten", "Lait", "Œufs"]'::jsonb),

  ('prod-tartelette-fraise-pistache', 'Tartelette Fraises & Crème d''Amande Pistache', 'patisseries_individuelles',
   'Pâte sablée croustillante au beurre, crème d''amande parfumée à la pistache et fraises fraîches lustrées.',
   2000, 'https://images.unsplash.com/photo-1519869325930-281384150729?auto=format&fit=crop&w=900&q=80', true, false,
   'Disponible en vitrine', NULL,
   '["Gluten", "Lait", "Fruits à coque", "Œufs"]'::jsonb),

  ('prod-eclair-chocolat-mbour', 'Éclair Chocolat Noir intense & Glaçage Miroir', 'patisseries_individuelles',
   'Pâte à choux légère, généreusement garnie de crème crémeuse au chocolat noir 64% et surmontée d''un glaçage brillant.',
   1500, 'https://images.unsplash.com/photo-1621303837174-89787a7d4729?auto=format&fit=crop&w=900&q=80', true, false,
   'Disponible en vitrine', NULL,
   '["Gluten", "Lait", "Œufs"]'::jsonb),

  ('prod-thiakry-cremeux-fleur-oranger', 'Verrine Thiakry Revisité Vanille & Fleur d''Oranger', 'patisseries_individuelles',
   'Le délice sénégalais revisité façon haute pâtisserie : couscous de mil torréfié, crème onctueuse au fromage blanc fermier, vanille et raisins dorés.',
   1700, 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=900&q=80', true, false,
   'Fait maison chaque matin', '🇸🇳 Douceur Locale',
   '["Lait"]'::jsonb),

  ('prod-fatayas-viande-epicee', 'Plateau de 10 Fatayas Viande Épicée & Sauce Piment Doux', 'traiteur_sale',
   'Petits chaussons dorés et croustillants garnis de viande hachée fraîche assaisonnée à la sénégalaise, oignons caramélisés et herbes fraîches.',
   3500, 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=80', true, false,
   'Chaud & prêt en 15-20 min', '🔥 Chaud & Croustillant',
   '["Gluten"]'::jsonb),

  ('prod-pastels-poisson-thiof', 'Plateau de 12 Pastels Poisson & Sauce Tomate Maison', 'traiteur_sale',
   'Beignets salés croustillants au filet de poisson assaisonné, accompagnés de notre fameuse sauce tomate pimentée douce cuite à feu doux.',
   3000, 'https://images.unsplash.com/photo-1608897013039-887f21d8c804?auto=format&fit=crop&w=900&q=80', true, false,
   'Préparé à la minute', NULL,
   '["Gluten", "Poisson"]'::jsonb),

  ('prod-quiche-poulet-champignons', 'Part de Quiche Artisanale Poulet Fumé & Champignons', 'traiteur_sale',
   'Pâte brisée maison pur beurre, morceaux de poulet fumé tendre, champignons sautés à l''ail doux et appareil crémeux muscadé.',
   2200, 'https://images.unsplash.com/photo-1541832676-9b763b0239ab?auto=format&fit=crop&w=900&q=80', true, false,
   'Chauffé à point', NULL,
   '["Gluten", "Lait", "Œufs"]'::jsonb),

  ('prod-jus-bissap-frais', 'Jus de Bissap Rouge Bio & Menthe Fraîche (50cl)', 'boissons_locales',
   'Infusion de fleurs d''hibiscus du terroir sénégalais avec des feuilles de menthe fraîche et une touche subtile de vanille. Servi très frais.',
   1000, 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=900&q=80', true, false,
   'Frais & Glacé', '🌺 100% Naturel',
   '[]'::jsonb),

  ('prod-jus-bouye-veloute', 'Jus de Bouye Velouté (Pain de Singe) & Lait (50cl)', 'boissons_locales',
   'Fruit du baobab riche en vitamines mélangé à du lait entier onctueux et parfum de fleur d''oranger. Une texture veloutée irrésistible.',
   1200, 'https://images.unsplash.com/photo-1577805947697-89e18249d767?auto=format&fit=crop&w=900&q=80', true, false,
   'Frais & Glacé', '🌳 Terroir Sénégal',
   '["Lait"]'::jsonb),

  ('prod-jus-gingembre-ananas', 'Jus de Gingembre Piquant & Ananas Victoria (50cl)', 'boissons_locales',
   'Gingembre frais pressé adouci par la douceur sucrée de l''ananas mûr à point. Tonifiant et vivifiant sous le soleil de Mbour.',
   1000, 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?auto=format&fit=crop&w=900&q=80', true, false,
   'Frais & Glacé', NULL,
   '[]'::jsonb);

-- ----------------------------------------------------------------------------
-- Paramètres de la boutique
-- ----------------------------------------------------------------------------
INSERT INTO bakery_settings (id, shop_name, tagline, city, address, phone_wave, phone_whatsapp, opening_hours, is_open, announcement) VALUES
  ('main', 'Mina''s Food',
   'Saveurs faites avec amour • Qualité, Fraîcheur & Passion',
   'Mbour, Sénégal',
   'Quartier Grand Mbour, Route de Saly, Mbour',
   '+221 77 407 81 20',
   '+221 77 407 81 20',
   'Du Mardi au Dimanche : 07h30 - 21h30 (Fermé le Lundi matin)',
   true,
   '✨ Fêtez vos événements avec nos gâteaux personnalisés ! Commande Wave en ligne avec livraison rapide à Mbour, Saly et environs.');

-- ----------------------------------------------------------------------------
-- Zones de livraison Mbour & Petite Côte
-- ----------------------------------------------------------------------------
INSERT INTO delivery_zones (id, name, fee, estimated_minutes, is_active) VALUES
  ('zone-mbour-centre',     'Mbour Centre, Escale, Tefess & Marché',          1000, 25, true),
  ('zone-mbour-quartiers',  'Mbour 1, 2, 3, 4 & Oncad',                       1200, 30, true),
  ('zone-saly',             'Saly Portudal, Saly Tapée, Golf & Niakh Niakhal',1500, 35, true),
  ('zone-somone-ngaparou',  'Ngaparou & Somone Plage',                        2000, 45, true),
  ('zone-warang-nianing',   'Warang & Nianing',                               2500, 50, true);

-- ----------------------------------------------------------------------------
-- Clients
-- ----------------------------------------------------------------------------
INSERT INTO customers (id, name, phone, email, favorite_zone, favorite_address, loyalty_points) VALUES
  ('cust_awa_01',   'Awa Diop',        '+221 77 123 45 67', 'awa.diop@gmail.com',
   'Mbour Centre & Tefess', 'Près de la Grande Mosquée de Mbour', 120),
  ('cust_jean_02',  'Jean-Marc Badji', '+221 78 456 78 90', 'jm.badji@saly.sn',
   'Saly Portudal & Tapée', 'Villa 14, Résidence Palm Beach, Saly', 75),
  ('cust_ibra_03',  'Ibrahima Ndiaye', '+221 78 123 99 88', NULL, NULL, NULL, 0),
  ('cust_khady_04', 'Khady Sow',       '+221 70 882 14 55', NULL, NULL, NULL, 0);

-- ----------------------------------------------------------------------------
-- Commandes + lignes de commande
-- ----------------------------------------------------------------------------
INSERT INTO orders (id, order_number, customer_id, customer_name, customer_phone, delivery_type, delivery_zone,
                    delivery_address, delivery_fee, subtotal, total, payment_method, payment_status,
                    wave_transaction_ref, status, customer_notes, requested_date, requested_time, created_at) VALUES
  ('ord-mina-101', 'MINA-4821', 'cust_awa_01', 'Awa Diop', '+221 77 654 32 10', 'livraison_mbour',
   'Saly Portudal, Saly Tapée, Golf & Niakh Niakhal', 'Villa 14, Résidence les Cocotiers près de la plage',
   1500, 14000, 15500, 'wave', 'paid', 'WV-MBR-2026-77891', 'preparing',
   'Merci de livrer avant 17h pour la surprise s''il vous plaît !', 'Aujourd''hui', '16:30 - 17:00',
   now() - interval '2 hours'),

  ('ord-mina-102', 'MINA-3904', 'cust_ibra_03', 'Ibrahima Ndiaye', '+221 78 123 99 88', 'retrait_boutique',
   'Retrait en boutique (Mbour Centre)', NULL,
   0, 8200, 8200, 'wave', 'paid', 'WV-MBR-2026-90312', 'ready_or_out',
   'Je passerai en voiture vers 18h.', 'Aujourd''hui', '18h00',
   now() - interval '4 hours'),

  ('ord-mina-103', 'MINA-7712', 'cust_khady_04', 'Khady Sow', '+221 70 882 14 55', 'livraison_mbour',
   'Mbour Centre, Escale, Tefess & Marché', 'Quartier Tefess, face au quai de pêche, maison verte',
   1000, 12000, 13000, 'cash_delivery', 'pending', NULL, 'received',
   'Paiement en espèces dès l''arrivée du livreur.', 'Demain', '11:00 - 12:00',
   now() - interval '1 hour');

INSERT INTO order_items (order_id, cart_item_id, product_id, product_snapshot, quantity, unit_price, customization) VALUES
  ('ord-mina-101', 'item-1', 'prod-red-velvet-mina',
   '{"id": "prod-red-velvet-mina", "name": "Layer Cake Red Velvet Suprême", "price": 14000, "category": "gateaux"}'::jsonb,
   1, 14000,
   '{"servings": 8, "spongeFlavor": "Red Velvet velouté", "creamFilling": "Cream cheese vanille bourbon", "inscriptionText": "Joyeux Anniversaire Aminata ❤️", "candlesCount": 25}'::jsonb),

  ('ord-mina-102', 'item-2', 'prod-croissant-pur-beurre',
   '{"id": "prod-croissant-pur-beurre", "name": "Croissant Feuilleté Pur Beurre", "price": 600, "category": "viennoiseries"}'::jsonb,
   4, 600, NULL),
  ('ord-mina-102', 'item-3', 'prod-pain-au-chocolat',
   '{"id": "prod-pain-au-chocolat", "name": "Pain au Chocolat Bâtonnets Purs", "price": 700, "category": "viennoiseries"}'::jsonb,
   4, 700, NULL),
  ('ord-mina-102', 'item-4', 'prod-fatayas-viande-epicee',
   '{"id": "prod-fatayas-viande-epicee", "name": "Plateau de 10 Fatayas Viande Épicée & Sauce Piment Doux", "price": 3500, "category": "traiteur_sale"}'::jsonb,
   1, 3500, NULL),

  ('ord-mina-103', 'item-5', 'prod-gateau-royal-chocolat',
   '{"id": "prod-gateau-royal-chocolat", "name": "Gâteau Royal Chocolat & Praliné Croustillant", "price": 12000, "category": "gateaux"}'::jsonb,
   1, 12000,
   '{"servings": 6, "spongeFlavor": "Chocolat Intense Grand Cru", "creamFilling": "Praliné feuillantine croustillant", "inscriptionText": "Bravo Khady pour le diplôme 🎓"}'::jsonb);