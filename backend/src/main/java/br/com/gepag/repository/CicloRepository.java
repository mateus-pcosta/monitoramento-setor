package br.com.gepag.repository;

import br.com.gepag.domain.Ciclo;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CicloRepository extends JpaRepository<Ciclo, Long> {

    List<Ciclo> findAllByOrderByAbertoEmDescIdDesc();

    Optional<Ciclo> findFirstByOrderByAbertoEmDescIdDesc();

    Optional<Ciclo> findFirstByEncerradoEmIsNullOrderByAbertoEmDescIdDesc();
}
