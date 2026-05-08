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
  anexos?: Anexo[];
}

export default function Home() {
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
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [filtroCondominio, setFiltroCondominio] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");

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
    await carregarCondominios();

    const { data, error } = await supabase
      .from("despesas")
      .select("*")
      .order("vencimento", { ascending: true });

    if (error) {
      console.log(error);
      alert("Erro ao carregar despesas.");
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

  async function enviarAnexo(despesaId: string) {
    if (!arquivo) return;

    const extensao = arquivo.name.split(".").pop();
    const caminho = `despesas/${despesaId}/${Date.now()}.${extensao}`;

    const { error: uploadError } = await supabase.storage
      .from("documentos")
      .upload(caminho, arquivo);

    if (uploadError) {
      console.log(uploadError);
      alert("Despesa salva, mas houve erro ao enviar o anexo.");
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

  async function salvarDespesa() {
    if (!condominioId || !descricao || !valor || !vencimento) {
      alert("Preencha condomínio, descrição, valor e vencimento.");
      return;
    }

    setSalvando(true);

    if (despesaEditandoId) {
      const { error } = await supabase
        .from("despesas")
        .update({
          condominio_id: condominioId,
          descricao,
          fornecedor,
          valor: Number(valor),
          vencimento,
          status,
        })
        .eq("id", despesaEditandoId);

      if (error) {
        console.log(error);
        alert("Erro ao atualizar despesa.");
        setSalvando(false);
        return;
      }

      await enviarAnexo(despesaEditandoId);
    } else {
      const { data, error } = await supabase
        .from("despesas")
        .insert([
          {
            condominio_id: condominioId,
            descricao,
            fornecedor,
            valor: Number(valor),
            vencimento,
            status,
          },
        ])
        .select()
        .single();

      if (error) {
        console.log(error);
        alert("Erro ao salvar despesa.");
        setSalvando(false);
        return;
      }

      if (data?.id) {
        await enviarAnexo(data.id);
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
    setArquivo(null);
  }

  async function alterarStatusRapido(id: string, novoStatus: string) {
    const { error } = await supabase
      .from("despesas")
      .update({
        status: novoStatus,
      })
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
    setFiltroDataInicio("");
    setFiltroDataFim("");
  }

  useEffect(() => {
    carregarTudo();
  }, []);

  const despesasFiltradas = despesas.filter((despesa) => {
    const passaCondominio =
      !filtroCondominio || despesa.condominio_id === filtroCondominio;

    const passaStatus = !filtroStatus || despesa.status === filtroStatus;

    const passaDataInicio =
      !filtroDataInicio || despesa.vencimento >= filtroDataInicio;

    const passaDataFim = !filtroDataFim || despesa.vencimento <= filtroDataFim;

    return passaCondominio && passaStatus && passaDataInicio && passaDataFim;
  });

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

    const linhas = despesasFiltradas.map((despesa) => [
      nomeDoCondominio(despesa.condominio_id),
      despesa.descricao,
      despesa.fornecedor || "-",
      formatarMoeda(Number(despesa.valor)),
      despesa.vencimento,
      despesa.status,
    ]);

    autoTable(doc, {
      startY: 40,
      head: [
        [
          "Condomínio",
          "Descrição",
          "Fornecedor",
          "Valor",
          "Vencimento",
          "Status",
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

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="border rounded-xl p-3"
            >
              <option value="">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
              <option value="vencido">Vencido</option>
            </select>

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

            <button
              onClick={limparFiltros}
              className="bg-gray-700 text-white rounded-xl p-3"
            >
              Limpar filtros
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-6 mt-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              Despesas Cadastradas
            </h2>

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