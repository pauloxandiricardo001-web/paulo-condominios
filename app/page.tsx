"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  DollarSign,
  AlertTriangle,
  Clock3,
  PlusCircle,
  Pencil,
  XCircle,
  Paperclip,
  FileText,
  Trash2,
  Filter,
  ReceiptText,
  Search,
} from "lucide-react";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { supabase } from "@/lib/supabase";

interface Condominio {
  id: string;
  nome: string;
  endereco: string;
}

interface Anexo {
  id: string;
  despesa_id: string;
  nome_arquivo: string;
  url: string;
  tipo: string;
}

interface Despesa {
  id: string;
  condominio_id: string;
  descricao: string;
  fornecedor: string;
  valor: number;
  vencimento: string;
  status: string;
  tipo_pagamento?: string;
  chave_pix?: string;
  recorrente_mensal?: boolean;
  anexos?: Anexo[];
}

export default function Home() {
  const mesAtual = String(new Date().getMonth() + 1);
  const anoAtual = String(new Date().getFullYear());

  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);

  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");

  const [despesaEditandoId, setDespesaEditandoId] = useState<string | null>(null);

  const [condominioId, setCondominioId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [status, setStatus] = useState("pendente");
  const [tipoPagamento, setTipoPagamento] = useState("pix");
  const [chavePix, setChavePix] = useState("");
  const [recorrenteMensal, setRecorrenteMensal] = useState(false);
  const [quantidadeMeses, setQuantidadeMeses] = useState("12");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [filtroCondominio, setFiltroCondominio] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroMes, setFiltroMes] = useState(mesAtual);
  const [filtroAno, setFiltroAno] = useState(anoAtual);
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroSemana, setFiltroSemana] = useState(false);

  async function atualizarDespesasVencidas() {
    const hoje = new Date().toISOString().split("T")[0];

    const { error } = await supabase
      .from("despesas")
      .update({ status: "vencido" })
      .lt("vencimento", hoje)
      .eq("status", "pendente");

    if (error) {
      console.log(error);
    }
  }

  async function carregarCondominios() {
    const { data, error } = await supabase
      .from("condominios")
      .select("*")
      .order("nome", { ascending: true });

    if (error) {
      console.log(error);
      alert("Erro ao carregar condomínios.");
      return;
    }

    setCondominios(data || []);
  }

  async function carregarAnexosDaDespesa(despesaId: string) {
    const { data, error } = await supabase
      .from("anexos")
      .select("*")
      .eq("despesa_id", despesaId);

    if (error) {
      console.log(error);
      return [];
    }

    return data || [];
  }

  async function carregarTudo() {
    await atualizarDespesasVencidas();
    await carregarCondominios();

    const { data, error } = await supabase
      .from("despesas")
      .select("*")
      .order("vencimento", { ascending: true });

    if (error) {
      console.log(error);
      alert("Erro ao carregar despesas. Verifique se as novas colunas foram criadas no Supabase.");
      return;
    }

    const despesasComAnexos = await Promise.all(
      (data || []).map(async (despesa) => {
        const anexos = await carregarAnexosDaDespesa(despesa.id);

        return {
          ...despesa,
          anexos,
        };
      })
    );

    setDespesas(despesasComAnexos);
  }

  async function adicionarCondominio() {
    if (!nome) {
      alert("Informe o nome do condomínio.");
      return;
    }

    const { error } = await supabase.from("condominios").insert([
      {
        nome,
        endereco,
      },
    ]);

    if (error) {
      console.log(error);
      alert("Erro ao salvar condomínio.");
      return;
    }

    setNome("");
    setEndereco("");
    await carregarCondominios();
  }

  function limparNomeArquivo(nomeArquivo: string) {
    return nomeArquivo
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9.\-_]/g, "-");
  }

  async function enviarAnexo(despesaId: string) {
    if (!arquivo) return;

    const nomeSeguro = limparNomeArquivo(arquivo.name);
    const caminho = `despesas/${despesaId}/${Date.now()}-${nomeSeguro}`;

    const { error: uploadError } = await supabase.storage
      .from("documentos")
      .upload(caminho, arquivo, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.log(uploadError);
      alert(
        "Despesa salva, mas houve erro ao enviar o anexo. Confira se o bucket 'documentos' está público e se as políticas do Storage foram criadas."
      );
      return;
    }

    const { data } = supabase.storage.from("documentos").getPublicUrl(caminho);

    const { error: anexoError } = await supabase.from("anexos").insert([
      {
        despesa_id: despesaId,
        nome_arquivo: arquivo.name,
        url: data.publicUrl,
        tipo: arquivo.type,
      },
    ]);

    if (anexoError) {
      console.log(anexoError);
      alert("Arquivo enviado, mas houve erro ao salvar o anexo no banco.");
    }
  }

  function adicionarMeses(dataISO: string, meses: number) {
    const [ano, mes, dia] = dataISO.split("-").map(Number);
    const data = new Date(ano, mes - 1 + meses, dia);
    const yyyy = data.getFullYear();
    const mm = String(data.getMonth() + 1).padStart(2, "0");
    const dd = String(data.getDate()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd}`;
  }

  function calcularStatusFinal(statusEscolhido: string, dataVencimento: string) {
    const hoje = new Date().toISOString().split("T")[0];

    if (statusEscolhido === "pendente" && dataVencimento < hoje) {
      return "vencido";
    }

    return statusEscolhido;
  }

  async function salvarDespesa() {
    if (!condominioId || !descricao || !valor || !vencimento) {
      alert("Preencha condomínio, descrição, valor e vencimento.");
      return;
    }

    if (tipoPagamento === "pix" && !chavePix) {
      const continuar = window.confirm(
        "Você selecionou PIX, mas não informou a chave PIX. Deseja salvar mesmo assim?"
      );

      if (!continuar) return;
    }

    setSalvando(true);

    if (despesaEditandoId) {
      const statusFinal = calcularStatusFinal(status, vencimento);

      const { error } = await supabase
        .from("despesas")
        .update({
          condominio_id: condominioId,
          descricao,
          fornecedor,
          valor: Number(valor),
          vencimento,
          status: statusFinal,
          tipo_pagamento: tipoPagamento,
          chave_pix: tipoPagamento === "pix" ? chavePix : "",
          recorrente_mensal: recorrenteMensal,
        })
        .eq("id", despesaEditandoId);

      if (error) {
        console.log(error);
        alert("Erro ao atualizar despesa. Verifique se as colunas de pagamento foram criadas no Supabase.");
        setSalvando(false);
        return;
      }

      await enviarAnexo(despesaEditandoId);
    } else {
      const meses = recorrenteMensal
        ? Math.max(1, Math.min(60, Number(quantidadeMeses) || 12))
        : 1;

      const novasDespesas = Array.from({ length: meses }).map((_, index) => {
        const vencimentoMensal = adicionarMeses(vencimento, index);

        return {
          condominio_id: condominioId,
          descricao: recorrenteMensal
            ? `${descricao} - ${String(index + 1).padStart(2, "0")}/${String(meses).padStart(2, "0")}`
            : descricao,
          fornecedor,
          valor: Number(valor),
          vencimento: vencimentoMensal,
          status: calcularStatusFinal(status, vencimentoMensal),
          tipo_pagamento: tipoPagamento,
          chave_pix: tipoPagamento === "pix" ? chavePix : "",
          recorrente_mensal: recorrenteMensal,
        };
      });

      const { data, error } = await supabase
        .from("despesas")
        .insert(novasDespesas)
        .select();

      if (error) {
        console.log(error);
        alert("Erro ao salvar despesa. Verifique se as colunas de pagamento foram criadas no Supabase.");
        setSalvando(false);
        return;
      }

      if (data?.[0]?.id) {
        await enviarAnexo(data[0].id);
      }
    }

    limparFormularioDespesa();
    await carregarTudo();
    setSalvando(false);
  }

  function editarDespesa(despesa: Despesa) {
    setDespesaEditandoId(despesa.id);
    setCondominioId(despesa.condominio_id);
    setDescricao(despesa.descricao || "");
    setFornecedor(despesa.fornecedor || "");
    setValor(String(despesa.valor || ""));
    setVencimento(despesa.vencimento || "");
    setStatus(despesa.status || "pendente");
    setTipoPagamento(despesa.tipo_pagamento || "pix");
    setChavePix(despesa.chave_pix || "");
    setRecorrenteMensal(Boolean(despesa.recorrente_mensal));
    setArquivo(null);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function limparFormularioDespesa() {
    setDespesaEditandoId(null);
    setCondominioId("");
    setDescricao("");
    setFornecedor("");
    setValor("");
    setVencimento("");
    setStatus("pendente");
    setTipoPagamento("pix");
    setChavePix("");
    setRecorrenteMensal(false);
    setQuantidadeMeses("12");
    setArquivo(null);
  }

  async function alterarStatusRapido(id: string, novoStatus: string) {
    const { error } = await supabase
      .from("despesas")
      .update({ status: novoStatus })
      .eq("id", id);

    if (error) {
      console.log(error);
      alert("Erro ao alterar status.");
      return;
    }

    await carregarTudo();
  }

  async function excluirDespesa(id: string) {
    const confirmar = window.confirm(
      "Tem certeza que deseja excluir esta despesa?"
    );

    if (!confirmar) return;

    const { error } = await supabase.from("despesas").delete().eq("id", id);

    if (error) {
      console.log(error);
      alert("Erro ao excluir despesa.");
      return;
    }

    if (despesaEditandoId === id) {
      limparFormularioDespesa();
    }

    await carregarTudo();
  }

  function nomeDoCondominio(id: string) {
    return condominios.find((c) => c.id === id)?.nome || "-";
  }

  function limparFiltros() {
    setFiltroCondominio("");
    setFiltroStatus("");
    setFiltroMes(mesAtual);
    setFiltroAno(anoAtual);
    setFiltroDataInicio("");
    setFiltroDataFim("");
  }

  function mostrarTodasAsDespesas() {
    setFiltroCondominio("");
    setFiltroStatus("");
    setFiltroMes("");
    setFiltroAno("");
    setFiltroDataInicio("");
    setFiltroDataFim("");
  }

  useEffect(() => {
    carregarTudo();
  }, []);

  const hoje = new Date();

  const inicioSemana = new Date(hoje);
  inicioSemana.setDate(hoje.getDate() - hoje.getDay());

  const fimSemana = new Date(inicioSemana);
  fimSemana.setDate(inicioSemana.getDate() + 6);

  const despesasFiltradas = despesas.filter((despesa) => {
    const [anoDespesa, mesDespesa] = despesa.vencimento.split("-");

    const passaCondominio =
      !filtroCondominio || despesa.condominio_id === filtroCondominio;

    const passaStatus = !filtroStatus || despesa.status === filtroStatus;

    const passaMes = !filtroMes || Number(mesDespesa) === Number(filtroMes);

    const passaAno = !filtroAno || anoDespesa === filtroAno;

    const passaDataInicio =
      !filtroDataInicio || despesa.vencimento >= filtroDataInicio;

    const passaDataFim = !filtroDataFim || despesa.vencimento <= filtroDataFim;

    const textoBusca = `
      ${despesa.descricao}
      ${despesa.fornecedor}
      ${despesa.valor}
    `.toLowerCase();

    const passaBusca = textoBusca.includes(busca.toLowerCase());

    let passaSemana = true;

    if (filtroSemana) {
      const dataDespesa = new Date(despesa.vencimento);

      passaSemana =
        dataDespesa >= inicioSemana && dataDespesa <= fimSemana;
    }

    return (
      passaCondominio &&
      passaStatus &&
      passaMes &&
      passaAno &&
      passaDataInicio &&
      passaDataFim &&
      passaBusca &&
      passaSemana
    );
  });

  const anosDisponiveis = Array.from(
    new Set([
      anoAtual,
      ...despesas
        .map((despesa) => despesa.vencimento?.split("-")[0])
        .filter(Boolean),
    ])
  ).sort();

  const nomeMesSelecionado = filtroMes
    ? new Date(2026, Number(filtroMes) - 1, 1).toLocaleDateString("pt-BR", {
        month: "long",
      })
    : "todos os meses";

  const totalPago = despesasFiltradas
    .filter((d) => d.status === "pago")
    .reduce((acc, d) => acc + Number(d.valor || 0), 0);

  const totalPendente = despesasFiltradas
    .filter((d) => d.status === "pendente")
    .reduce((acc, d) => acc + Number(d.valor || 0), 0);

  const totalVencido = despesasFiltradas
    .filter((d) => d.status === "vencido")
    .reduce((acc, d) => acc + Number(d.valor || 0), 0);

  function formatarMoeda(valor: number) {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatarFormaPagamento(tipo?: string) {
    if (tipo === "pix") return "PIX";
    if (tipo === "boleto") return "Boleto";
    if (tipo === "ted") return "TED";
    if (tipo === "dinheiro") return "Dinheiro";

    return "-";
  }

  function gerarPDF() {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Relatório Financeiro - Paulo Condomínios", 14, 20);

    doc.setFontSize(11);
    doc.text(
      `Data de emissão: ${new Date().toLocaleDateString("pt-BR")}`,
      14,
      30
    );

    doc.text(
      `Período: ${nomeMesSelecionado}${filtroAno ? `/${filtroAno}` : ""}`,
      14,
      37
    );

    const linhas = despesasFiltradas.map((despesa) => [
      nomeDoCondominio(despesa.condominio_id),
      despesa.descricao,
      despesa.fornecedor || "-",
      formatarMoeda(Number(despesa.valor)),
      despesa.vencimento,
      despesa.status,
      formatarFormaPagamento(despesa.tipo_pagamento),
    ]);

    autoTable(doc, {
      startY: 47,
      head: [
        [
          "Condomínio",
          "Descrição",
          "Fornecedor",
          "Valor",
          "Vencimento",
          "Status",
          "Pagamento",
        ],
      ],
      body: linhas,
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;

    doc.setFontSize(12);
    doc.text(`Total Pago: ${formatarMoeda(totalPago)}`, 14, finalY);
    doc.text(`Total Pendente: ${formatarMoeda(totalPendente)}`, 14, finalY + 10);
    doc.text(`Total Vencido: ${formatarMoeda(totalVencido)}`, 14, finalY + 20);

    doc.save("relatorio-financeiro-paulo-condominios.pdf");
  }

  function gerarRecibo(despesa: Despesa) {
    const doc = new jsPDF();
    const nomeCondominio = nomeDoCondominio(despesa.condominio_id);
    const dataAtual = new Date().toLocaleDateString("pt-BR");

    doc.setFontSize(18);
    doc.text("RECIBO DE PAGAMENTO", 105, 20, { align: "center" });

    doc.setFontSize(12);
    doc.text(`Condomínio: ${nomeCondominio}`, 20, 40);
    doc.text(
      `Prestador/Fornecedor: ${despesa.fornecedor || "________________________"}`,
      20,
      50
    );
    doc.text(`Serviço/Descrição: ${despesa.descricao}`, 20, 60);
    doc.text(`Valor: ${formatarMoeda(Number(despesa.valor))}`, 20, 70);
    doc.text(`Forma de pagamento: ${formatarFormaPagamento(despesa.tipo_pagamento)}`, 20, 80);

    if (despesa.tipo_pagamento === "pix") {
      doc.text(`Chave PIX: ${despesa.chave_pix || "________________________"}`, 20, 90);
    }

    doc.text(`Data de emissão: ${dataAtual}`, 20, despesa.tipo_pagamento === "pix" ? 100 : 90);

    doc.text(
      `Declaro, para os devidos fins, que recebi do ${nomeCondominio} a importância de ${formatarMoeda(
        Number(despesa.valor)
      )}, referente ao serviço descrito acima, dando plena e geral quitação do valor recebido.`,
      20,
      115,
      { maxWidth: 170 }
    );

    doc.text("________________________________________", 45, 160);
    doc.text("Assinatura do Prestador de Serviço", 60, 168);
    doc.text("CPF/CNPJ: ______________________________", 45, 185);

    doc.save(`recibo-${despesa.descricao}.pdf`);
  }

  return (
    <main className="min-h-screen bg-gray-100 flex">
      <aside className="w-72 bg-white shadow-lg p-6">
        <div className="flex items-center gap-3 mb-10">
          <Building2 size={34} className="text-blue-600" />

          <div>
            <h1 className="text-2xl font-bold text-gray-800">Paulo</h1>
            <p className="text-sm text-gray-500">Condomínios</p>
          </div>
        </div>

        <nav className="space-y-3">
          <button className="w-full bg-blue-600 text-white rounded-xl p-3 text-left">
            Dashboard
          </button>

          <button className="w-full hover:bg-gray-100 rounded-xl p-3 text-left">
            Condomínios
          </button>

          <button className="w-full hover:bg-gray-100 rounded-xl p-3 text-left">
            Despesas
          </button>

          <button className="w-full hover:bg-gray-100 rounded-xl p-3 text-left">
            Prestadores
          </button>

          <button className="w-full hover:bg-gray-100 rounded-xl p-3 text-left">
            Relatórios
          </button>
        </nav>
      </aside>

      <section className="flex-1 p-8 overflow-auto">
        <div className="mb-8">
          <h2 className="text-4xl font-bold text-gray-800">
            Dashboard Financeiro
          </h2>

          <p className="text-gray-500 mt-2">
            Controle completo das despesas por condomínio
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-gray-500 text-sm">Despesas Pagas</p>

                <h3 className="text-3xl font-bold text-green-600 mt-2">
                  {formatarMoeda(totalPago)}
                </h3>
              </div>

              <DollarSign className="text-green-600" size={38} />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-gray-500 text-sm">A Vencer</p>

                <h3 className="text-3xl font-bold text-yellow-500 mt-2">
                  {formatarMoeda(totalPendente)}
                </h3>
              </div>

              <Clock3 className="text-yellow-500" size={38} />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-gray-500 text-sm">Vencidas</p>

                <h3 className="text-3xl font-bold text-red-600 mt-2">
                  {formatarMoeda(totalVencido)}
                </h3>
              </div>

              <AlertTriangle className="text-red-600" size={38} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-6 mt-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            Cadastro de Condomínios
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <input
              type="text"
              placeholder="Nome do condomínio"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="border rounded-xl p-3"
            />

            <input
              type="text"
              placeholder="Endereço"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              className="border rounded-xl p-3"
            />

            <button
              onClick={adicionarCondominio}
              className="bg-blue-600 text-white rounded-xl p-3 flex items-center justify-center gap-2"
            >
              <PlusCircle size={18} />
              Salvar Condomínio
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-6 mt-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            {despesaEditandoId ? "Editar Despesa" : "Cadastro de Despesas"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <select
              value={condominioId}
              onChange={(e) => setCondominioId(e.target.value)}
              className="border rounded-xl p-3"
            >
              <option value="">Selecione o condomínio</option>

              {condominios.map((condominio) => (
                <option key={condominio.id} value={condominio.id}>
                  {condominio.nome}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Descrição da despesa"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="border rounded-xl p-3"
            />

            <input
              type="text"
              placeholder="Fornecedor / Prestador"
              value={fornecedor}
              onChange={(e) => setFornecedor(e.target.value)}
              className="border rounded-xl p-3"
            />

            <input
              type="number"
              placeholder="Valor"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="border rounded-xl p-3"
            />

            <input
              type="date"
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
              className="border rounded-xl p-3"
            />

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="border rounded-xl p-3"
            >
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
              <option value="vencido">Vencido</option>
            </select>

            <select
              value={tipoPagamento}
              onChange={(e) => setTipoPagamento(e.target.value)}
              className="border rounded-xl p-3"
            >
              <option value="pix">PIX</option>
              <option value="boleto">Boleto</option>
              <option value="ted">TED</option>
              <option value="dinheiro">Dinheiro</option>
            </select>

            {tipoPagamento === "pix" && (
              <input
                type="text"
                placeholder="Chave PIX do recebedor"
                value={chavePix}
                onChange={(e) => setChavePix(e.target.value)}
                className="border rounded-xl p-3 md:col-span-2"
              />
            )}

            <div className="md:col-span-3 border rounded-xl p-4 bg-gray-50">
              <label className="flex items-center gap-2 font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={recorrenteMensal}
                  onChange={(e) => setRecorrenteMensal(e.target.checked)}
                />
                Despesa mensal recorrente
              </label>

              {recorrenteMensal && !despesaEditandoId && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    placeholder="Quantidade de meses"
                    value={quantidadeMeses}
                    onChange={(e) => setQuantidadeMeses(e.target.value)}
                    className="border rounded-xl p-3"
                  />

                  <p className="text-sm text-gray-500 md:col-span-2">
                    Exemplo: se colocar 12, o sistema lançará esta despesa nos próximos 12 meses automaticamente.
                  </p>
                </div>
              )}
            </div>

            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Anexo opcional
              </label>

              <div className="flex items-center gap-4">
                <label className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-xl cursor-pointer flex items-center gap-2">
                  <Paperclip size={18} />

                  <span>Escolher arquivo</span>

                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setArquivo(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>

                {arquivo ? (
                  <span className="text-sm text-green-700 font-medium">
                    {arquivo.name}
                  </span>
                ) : (
                  <span className="text-sm text-gray-500">
                    Nenhum arquivo selecionado
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={salvarDespesa}
              disabled={salvando}
              className="bg-green-600 text-white rounded-xl p-3 flex items-center justify-center gap-2 md:col-span-2 disabled:opacity-60"
            >
              <PlusCircle size={18} />

              {salvando
                ? "Salvando..."
                : despesaEditandoId
                ? "Atualizar Despesa"
                : recorrenteMensal
                ? "Salvar Despesa Mensal"
                : "Salvar Despesa"}
            </button>

            {despesaEditandoId && (
              <button
                onClick={limparFormularioDespesa}
                className="bg-gray-500 text-white rounded-xl p-3 flex items-center justify-center gap-2"
              >
                <XCircle size={18} />
                Cancelar Edição
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-6 mt-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Filter size={22} />
            Filtros de Despesas
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <select
              value={filtroCondominio}
              onChange={(e) => setFiltroCondominio(e.target.value)}
              className="border rounded-xl p-3"
            >
              <option value="">Todos os condomínios</option>

              {condominios.map((condominio) => (
                <option key={condominio.id} value={condominio.id}>
                  {condominio.nome}
                </option>
              ))}
            </select>

            <select
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
              className="border rounded-xl p-3"
            >
              <option value="">Todos os meses</option>
              <option value="1">Janeiro</option>
              <option value="2">Fevereiro</option>
              <option value="3">Março</option>
              <option value="4">Abril</option>
              <option value="5">Maio</option>
              <option value="6">Junho</option>
              <option value="7">Julho</option>
              <option value="8">Agosto</option>
              <option value="9">Setembro</option>
              <option value="10">Outubro</option>
              <option value="11">Novembro</option>
              <option value="12">Dezembro</option>
            </select>

            <select
              value={filtroAno}
              onChange={(e) => setFiltroAno(e.target.value)}
              className="border rounded-xl p-3"
            >
              <option value="">Todos os anos</option>
              {anosDisponiveis.map((ano) => (
                <option key={ano} value={ano}>
                  {ano}
                </option>
              ))}
            </select>

            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="border rounded-xl p-3"
            >
              <option value="">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
              <option value="vencido">Vencido</option>
            </select>

            <button
              onClick={limparFiltros}
              className="bg-gray-700 text-white rounded-xl p-3"
            >
              Mês atual
            </button>

            <button
              onClick={mostrarTodasAsDespesas}
              className="bg-gray-500 text-white rounded-xl p-3"
            >
              Ver todas
            </button>
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-gray-600">
              Filtro avançado por intervalo de datas
            </summary>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <input
                type="date"
                value={filtroDataInicio}
                onChange={(e) => setFiltroDataInicio(e.target.value)}
                className="border rounded-xl p-3"
              />

              <input
                type="date"
                value={filtroDataFim}
                onChange={(e) => setFiltroDataFim(e.target.value)}
                className="border rounded-xl p-3"
              />
            </div>
          </details>
        </div>

        <div className="bg-white rounded-2xl shadow p-6 mt-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                Despesas Cadastradas
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Exibindo: {nomeMesSelecionado}{filtroAno ? `/${filtroAno}` : ""}
              </p>
            </div>

            <button
              onClick={gerarPDF}
              className="bg-red-600 text-white px-4 py-3 rounded-xl"
            >
              Gerar PDF
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-3">Condomínio</th>
                  <th className="p-3">Descrição</th>
                  <th className="p-3">Fornecedor</th>
                  <th className="p-3">Valor</th>
                  <th className="p-3">Vencimento</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Pagamento</th>
                  <th className="p-3">Anexos</th>
                  <th className="p-3">Ações</th>
                </tr>
              </thead>

              <tbody>
                {despesasFiltradas.map((despesa) => (
                  <tr key={despesa.id} className="border-b">
                    <td className="p-3">
                      {nomeDoCondominio(despesa.condominio_id)}
                    </td>

                    <td className="p-3">{despesa.descricao}</td>

                    <td className="p-3">{despesa.fornecedor}</td>

                    <td className="p-3">
                      {formatarMoeda(Number(despesa.valor))}
                    </td>

                    <td className="p-3">{despesa.vencimento}</td>

                    <td className="p-3">
                      <select
                        value={despesa.status}
                        onChange={(e) =>
                          alterarStatusRapido(despesa.id, e.target.value)
                        }
                        className={`px-3 py-1 rounded-full text-sm border ${
                          despesa.status === "pago"
                            ? "bg-green-100 text-green-700"
                            : despesa.status === "vencido"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        <option value="pendente">Pendente</option>
                        <option value="pago">Pago</option>
                        <option value="vencido">Vencido</option>
                      </select>
                    </td>

                    <td className="p-3">
                      <div>{formatarFormaPagamento(despesa.tipo_pagamento)}</div>
                      {despesa.tipo_pagamento === "pix" && despesa.chave_pix && (
                        <div className="text-xs text-gray-500 max-w-48 break-all">
                          Chave: {despesa.chave_pix}
                        </div>
                      )}
                    </td>

                    <td className="p-3">
                      {despesa.anexos && despesa.anexos.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {despesa.anexos.map((anexo) => (
                            <a
                              key={anexo.id}
                              href={anexo.url}
                              target="_blank"
                              className="text-blue-600 underline flex items-center gap-1"
                            >
                              <FileText size={16} />
                              {anexo.nome_arquivo}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">Sem anexo</span>
                      )}
                    </td>

                    <td className="p-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => gerarRecibo(despesa)}
                          className="bg-purple-600 text-white px-3 py-2 rounded-xl flex items-center gap-2"
                        >
                          <ReceiptText size={16} />
                          Recibo
                        </button>

                        <button
                          onClick={() => editarDespesa(despesa)}
                          className="bg-blue-600 text-white px-3 py-2 rounded-xl flex items-center gap-2"
                        >
                          <Pencil size={16} />
                          Editar
                        </button>

                        <button
                          onClick={() => excluirDespesa(despesa.id)}
                          className="bg-red-600 text-white px-3 py-2 rounded-xl flex items-center gap-2"
                        >
                          <Trash2 size={16} />
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {despesasFiltradas.length === 0 && (
              <p className="text-gray-500 text-center py-6">
                Nenhuma despesa encontrada com os filtros selecionados.
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
